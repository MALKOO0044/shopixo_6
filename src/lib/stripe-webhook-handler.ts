import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { maybeCreateCjOrderForOrderId } from '@/lib/ops/cj-fulfill';
import { loggerForRequest } from '@/lib/log';
import { ensureEnv, getEnv } from '@/lib/env';

export async function handleStripeWebhook(req: Request): Promise<Response> {
  const log = loggerForRequest(req);
  const textBody = await req.text();
  const signature =
    (req.headers.get("stripe-signature") as string | null) ||
    (req.headers.get("Stripe-Signature") as string | null);

  const need = ensureEnv(['STRIPE_WEBHOOK_SECRET','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']);
  if (!need.ok) {
    log.error("stripe_webhook_env_missing", { keys: need.missing });
    const r = new Response("Server misconfiguration", { status: 500 });
    r.headers.set('x-request-id', log.requestId);
    return r;
  }
  const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET') as string;
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') as string;
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') as string;

  if (!signature) {
    const r = new Response("Missing stripe-signature header", { status: 400 });
    r.headers.set('x-request-id', log.requestId);
    return r;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(textBody, signature, webhookSecret);
  } catch (err: any) {
    log.error('stripe_webhook_verify_failed', { error: err?.message || String(err) });
    const r = new Response(`Webhook Error: ${err.message}`, { status: 400 });
    r.headers.set('x-request-id', log.requestId);
    return r;
  }
  log.info("stripe_webhook_event", { id: event.id, type: event.type });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        // We support two formats for backward compatibility:
        // 1) metadata.cart (JSON string of items)
        // 2) metadata.cartSessionId (legacy, not used anymore)
        if (metadata.cart) {
          const userId = metadata.userId as string | undefined;
          if (!userId) {
            log.error("stripe_missing_user_id");
            break;
          }

          const parsedCart: Array<{ productId: number | string; variantId?: number | string | null; quantity: number; price: number }>
            = JSON.parse(metadata.cart as string);

          // Compute total using Stripe-authoritative data (fallback to line items if amount_total is unavailable)
          let totalAmount = 0;
          try {
            if (typeof (session as any).amount_total === 'number') {
              totalAmount = ((session as any).amount_total as number) / 100;
            } else {
              const stripe = getStripe();
              const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
              const cents = li.data.reduce((acc, item: any) => {
                const itemTotal = typeof item.amount_total === 'number'
                  ? item.amount_total
                  : ((item.price?.unit_amount || 0) * (item.quantity || 1));
                return acc + itemTotal;
              }, 0);
              totalAmount = cents / 100;
            }
          } catch (e) {
            log.warn('stripe_compute_total_fallback');
            totalAmount = parsedCart.reduce((acc, i) => acc + i.price * i.quantity, 0);
          }

          // 1) Create or update order (idempotent on stripe_session_id)
          const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .upsert(
              { user_id: userId, total_amount: totalAmount, status: "paid", stripe_session_id: session.id },
              { onConflict: "stripe_session_id" }
            )
            .select()
            .single();
          if (orderError || !order) {
            log.error("stripe_order_upsert_error", { error: orderError?.message || String(orderError) });
            const r = new Response("Error creating order", { status: 500 });
            r.headers.set('x-request-id', log.requestId);
            return r;
          }

          // If order already has items, we've processed this event; exit early (idempotency)
          const { count: existingItemsCount, error: countError } = await supabaseAdmin
            .from("order_items")
            .select("id", { count: "exact", head: true })
            .eq("order_id", order.id);
          if (countError) {
            log.warn("stripe_order_items_count_error", { error: countError?.message || String(countError) });
          }
          if ((existingItemsCount ?? 0) > 0) {
            break;
          }

          // 2) Create order items
          const orderItems = parsedCart.map((item) => ({
            order_id: order.id,
            product_id: typeof item.productId === 'string' ? Number(item.productId) : item.productId,
            variant_id: item.variantId ? (typeof item.variantId === 'string' ? Number(item.variantId) : item.variantId) : null,
            quantity: item.quantity,
            price: item.price,
          }));
          const { error: itemsError } = await supabaseAdmin
            .from("order_items")
            .insert(orderItems);
          if (itemsError) {
            log.error("stripe_order_items_error", { error: itemsError?.message || String(itemsError) });
            const r = new Response("Error creating order items", { status: 500 });
            r.headers.set('x-request-id', log.requestId);
            return r;
          }

          // 3) Decrement stock (best-effort)
          await Promise.all(
            parsedCart.map(async (item) => {
              const pid = typeof item.productId === 'string' ? Number(item.productId) : item.productId;
              const vid = item.variantId ? (typeof item.variantId === 'string' ? Number(item.variantId) : item.variantId) : null;
              if (vid) {
                // Decrement variant stock; trigger will recompute product stock
                return supabaseAdmin.rpc("decrement_variant_stock", {
                  variant_id_in: vid,
                  quantity_in: item.quantity,
                });
              }

              // Strict fallback policy: only allow product-level decrement for true single-variant products.
              const { count: variantRowsCount } = await supabaseAdmin
                .from("product_variants")
                .select("id", { count: "exact", head: true })
                .eq("product_id", pid);

              const hasConfigurableVariants = Number(variantRowsCount || 0) > 1;
              if (hasConfigurableVariants) {
                log.warn("stripe_variant_id_missing_for_configurable", {
                  orderId: order.id,
                  productId: pid,
                  quantity: item.quantity,
                  variantRowsCount,
                });
                return null;
              }

              if (Number(variantRowsCount || 0) === 1) {
                const { data: singleVariant } = await supabaseAdmin
                  .from("product_variants")
                  .select("id")
                  .eq("product_id", pid)
                  .maybeSingle();

                if (singleVariant?.id) {
                  return supabaseAdmin.rpc("decrement_variant_stock", {
                    variant_id_in: singleVariant.id,
                    quantity_in: item.quantity,
                  });
                }
              }

              return supabaseAdmin.rpc("decrement_stock", {
                product_id_in: pid,
                quantity_in: item.quantity,
              });
            })
          );

          // 4) Trigger CJ fulfillment (best-effort, non-blocking errors). This is idempotent upstream via CJ orderNo.
          try {
            const ful = await maybeCreateCjOrderForOrderId(order.id as number);
            if (!ful.ok) {
              log.warn('stripe_cj_fulfillment_warn', { reason: ful.reason });
            }
          } catch (e: any) {
            log.warn('stripe_cj_fulfillment_error', { error: e?.message || String(e) });
          }

          // 5) Best-effort: clear cart items by session ID (if provided)
          const cartSessionId = (metadata.cartSessionId as string | undefined) || undefined;
          if (cartSessionId) {
            const { error: clearErr } = await supabaseAdmin
              .from("cart_items")
              .delete()
              .eq("session_id", cartSessionId);
            if (clearErr) {
              console.warn("Failed to clear cart items for session after payment:", clearErr);
            }
          }
        } else if (metadata.cartSessionId) {
          // Legacy path: metadata had cartSessionId/userId; keep 200 so Stripe doesn't retry.
          log.warn("stripe_legacy_webhook_format");
        }
        break;
      }
      default: {
        // No-op
        break;
      }
    }
  } catch (e: any) {
    log.error("stripe_webhook_unhandled_error", { error: e?.message || String(e) });
    const r = new Response("Internal Server Error", { status: 500 });
    r.headers.set('x-request-id', log.requestId);
    return r;
  }

  const r = new Response(null, { status: 200 });
  r.headers.set('x-request-id', log.requestId);
  return r;
}
