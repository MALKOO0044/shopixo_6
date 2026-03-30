"use client";

import { Star, TrendingUp, Image as ImageIcon, Tag, Ruler, FolderOpen, DollarSign, Info, Palette } from "lucide-react";
import SmartImage from "@/components/smart-image";
import { enhanceProductImageUrl } from "@/lib/media/image-quality";
import { normalizeDisplayedRating } from "@/lib/rating/engine";
import { sarToUsd } from "@/lib/pricing";
import type { PricedProduct } from "./types";
import {
  deriveAvailableOptionsFromVariants,
  extractPreferredOptionOrderFromProductProperties,
  parseDynamicAvailableOptions,
} from "@/lib/variants/dynamic-options";

type PreviewPageOneProps = {
  product: PricedProduct;
};

function confidenceLabel(c?: number | null) {
  if (typeof c !== "number") return "unknown";
  if (c >= 0.75) return "high";
  if (c >= 0.4) return "medium";
  return "low";
}

function getPopularityInfo(listedNum: number): { label: string; level: number; color: string; bgColor: string } {
  if (listedNum >= 1000) {
    return { label: "Very Popular", level: 5, color: "text-green-700", bgColor: "bg-green-100" };
  }
  if (listedNum >= 500) {
    return { label: "Popular", level: 4, color: "text-emerald-700", bgColor: "bg-emerald-100" };
  }
  if (listedNum >= 100) {
    return { label: "Moderate Popularity", level: 3, color: "text-blue-700", bgColor: "bg-blue-100" };
  }
  if (listedNum >= 20) {
    return { label: "Low Popularity", level: 2, color: "text-amber-700", bgColor: "bg-amber-100" };
  }
  return { label: "New", level: 1, color: "text-gray-700", bgColor: "bg-gray-100" };
}

function PopularityDisplay({ listedNum }: { listedNum: number }) {
  const info = getPopularityInfo(listedNum);
  
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className={`px-4 py-2 rounded-lg font-semibold ${info.bgColor} ${info.color}`}>
          {info.label}
        </span>
        <span className="text-xl font-bold text-gray-800">{listedNum.toLocaleString()}</span>
        <span className="text-gray-500 text-sm">times listed</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 w-8 rounded ${i <= info.level ? 'bg-amber-400' : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  );
}

type PreviewRenderableOption = {
  name: string;
  allValues: string[];
  inStockValuesClean: string[];
  displayValues: string[];
  hasInStockValues: boolean;
  stockStateLabel: string;
  stockStateClassName: string;
};

function normalizeOptionValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export default function PreviewPageOne({ product }: PreviewPageOneProps) {
  const dynamicAvailableOptions = (() => {
    const direct = parseDynamicAvailableOptions((product as any).availableOptions ?? (product as any).available_options);
    if (direct.length > 0) return direct;

    const preferredOptionOrder = extractPreferredOptionOrderFromProductProperties({
      productPropertyList: (product as any).productPropertyList ?? (product as any).product_property_list,
      propertyList: (product as any).propertyList ?? (product as any).property_list,
      productOptions: (product as any).productOptions ?? (product as any).product_options,
    });

    const variantDerived = deriveAvailableOptionsFromVariants(
      Array.isArray((product as any).variants) ? ((product as any).variants as any[]) : [],
      { includeOutOfStockDimensions: false, preferredOptionOrder }
    );
    return variantDerived;
  })();
  const renderableDynamicOptions: PreviewRenderableOption[] = dynamicAvailableOptions
    .map((option) => {
      const inStockValuesClean = normalizeOptionValues(option.inStockValues);
      const allValues = normalizeOptionValues(option.values);
      const displayValues = inStockValuesClean.length > 0 ? inStockValuesClean : allValues;

      return {
        name: option.name,
        allValues,
        inStockValuesClean,
        displayValues,
        hasInStockValues: inStockValuesClean.length > 0,
        stockStateLabel: inStockValuesClean.length > 0
          ? `${inStockValuesClean.length} in stock`
          : '0 in stock / unknown stock',
        stockStateClassName: inStockValuesClean.length > 0 ? 'text-emerald-600' : 'text-amber-600',
      };
    })
    .filter((option) => option.displayValues.length > 0);

  const legacyFallbackOptionGroups: Array<{ name: string; values: string[] }> = [
    { name: 'Color', values: normalizeOptionValues((product as any).availableColors ?? (product as any).available_colors) },
    { name: 'Size', values: normalizeOptionValues((product as any).availableSizes ?? (product as any).available_sizes) },
    { name: 'Model', values: normalizeOptionValues((product as any).availableModels ?? (product as any).available_models) },
  ];

  const legacyFallbackOptions: PreviewRenderableOption[] = legacyFallbackOptionGroups
    .filter((entry) => entry.values.length > 0)
    .map((entry) => ({
      name: entry.name,
      allValues: entry.values,
      inStockValuesClean: [],
      displayValues: entry.values,
      hasInStockValues: false,
      stockStateLabel: 'Legacy fallback values',
      stockStateClassName: 'text-gray-500',
    }));

  const displayOptions = renderableDynamicOptions.length > 0 ? renderableDynamicOptions : legacyFallbackOptions;

  const imageCount = product.images?.length || 0;
  const previewSku = (() => {
    const pid = String((product as any)?.pid || (product as any)?.cjProductId || "");
    let h = 2166136261;
    for (let i = 0; i < pid.length; i++) {
      h ^= pid.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const n = Math.abs(h) % 100000000;
    return `xo${n.toString().padStart(8, "0")}`;
  })();
  const displayedRating = normalizeDisplayedRating(product.displayedRating);
  const ratingConfidence = product.ratingConfidence ?? null;
  const reviewCount = Number.isFinite(Number(product.reviewCount))
    ? Math.max(0, Math.floor(Number(product.reviewCount)))
    : 0;

  console.log(
    `[PreviewPageOne] Product ${product.cjSku}: listedNum=${product.listedNum}, displayedRating=${displayedRating}, confidence=${ratingConfidence}, optionDimensions=${displayOptions.length}`
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4">
      {/* Main Image Section */}
      <div className="lg:w-1/2 flex flex-col items-center">
        <div className="relative w-full max-w-md aspect-square bg-gray-50 rounded-2xl overflow-hidden shadow-md border border-gray-100">
          {product.images?.[0] ? (
            <SmartImage
              src={enhanceProductImageUrl(product.images[0], "gallery")}
              alt="Product image"
              fill
              quality={95}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-20 w-20 text-gray-300" />
            </div>
          )}
        </div>
        
        {/* Image Count */}
        <div className="mt-4 flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full">
          <ImageIcon className="h-5 w-5" />
          <span className="font-medium">{imageCount} images available</span>
        </div>
      </div>

      {/* Product Details Section */}
      <div className="lg:w-1/2 space-y-8">
        
        {/* Rating - Internal Product Rating Engine */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Star className="h-5 w-5 text-amber-500" />
            <span className="text-gray-500 font-medium">Rating</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={`star-${i}`}
                  className={`h-6 w-6 ${
                    i < Math.floor(displayedRating)
                      ? "fill-amber-400 text-amber-400"
                      : i < displayedRating
                        ? "fill-amber-300 text-amber-300"
                        : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-2xl font-bold text-gray-800">{displayedRating.toFixed(1)}</span>
            <span className="text-sm text-gray-500">{confidenceLabel(ratingConfidence)} confidence</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">{reviewCount.toLocaleString('en-US')} Reviewed</p>
        </div>

        {/* Popularity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-gray-500 font-medium">Popularity</span>
            <div className="group relative">
              <Info className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-3 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-10">
                Based on how many stores list this product on CJ Dropshipping
              </div>
            </div>
          </div>
          <PopularityDisplay listedNum={product.listedNum || 0} />
        </div>

        {/* SKU */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Tag className="h-5 w-5 text-blue-600" />
            <span className="text-gray-500 font-medium">Product SKU</span>
          </div>
          <p className="font-mono text-2xl font-bold text-blue-700 bg-blue-50 px-4 py-3 rounded-lg">
            {product.cjSku}
          </p>
        </div>

        {/* Store SKU (Preview) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Tag className="h-5 w-5 text-emerald-600" />
            <span className="text-gray-500 font-medium">Store SKU (preview)</span>
          </div>
          <p className="font-mono text-2xl font-bold text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
            {product.storeSku || previewSku}
          </p>
          <p className="mt-2 text-xs text-gray-500">Final SKU is guaranteed unique and will be assigned when you add to queue.</p>
        </div>

        {/* Available options */}
        {displayOptions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-pink-600" />
              <span className="text-gray-500 font-medium">Available Options</span>
              <span className="text-sm text-gray-400">({displayOptions.length} dimensions)</span>
            </div>

            {displayOptions.map((option) => (
              <div key={option.name} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">{option.name}:</span>
                  <span className="text-xs text-gray-400">({option.displayValues.length})</span>
                  <span className={`text-xs ${option.stockStateClassName}`}>
                    {option.stockStateLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {option.displayValues.map((value, idx) => (
                    <span
                      key={`${option.name}-${idx}-${value}`}
                      className="bg-pink-50 text-pink-700 px-3 py-1.5 rounded-lg font-medium text-sm border border-pink-200"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No options message */}
        {displayOptions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Ruler className="h-5 w-5 text-purple-600" />
              <span className="text-gray-500 font-medium">Available Options</span>
            </div>
            <p className="text-gray-400 text-lg">No option dimensions provided by supplier (normal for simple products)</p>
          </div>
        )}

        {/* Category */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <FolderOpen className="h-5 w-5 text-green-600" />
            <span className="text-gray-500 font-medium">Category</span>
          </div>
          <p className="text-lg text-gray-800 font-medium">
            {product.categoryName || "Not specified"}
          </p>
        </div>

        {/* Price - Single Final Sell Price */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-gray-600 font-medium">Price</span>
          </div>
          {(() => {
            const directMinUsd = Number((product as any).minPriceUSD);
            const directMaxUsd = Number((product as any).maxPriceUSD);
            const directAvgUsd = Number((product as any).avgPriceUSD);

            const minUsd = Number.isFinite(directMinUsd) && directMinUsd > 0
              ? directMinUsd
              : Number(product.minPriceSAR) > 0
                ? sarToUsd(Number(product.minPriceSAR))
                : NaN;
            const maxUsd = Number.isFinite(directMaxUsd) && directMaxUsd > 0
              ? directMaxUsd
              : Number(product.maxPriceSAR) > 0
                ? sarToUsd(Number(product.maxPriceSAR))
                : NaN;
            const avgUsd = Number.isFinite(directAvgUsd) && directAvgUsd > 0
              ? directAvgUsd
              : Number(product.avgPriceSAR) > 0
                ? sarToUsd(Number(product.avgPriceSAR))
                : NaN;
            const appliedMargin = Number((product as any).profitMarginApplied);

            if (Number.isFinite(minUsd) && minUsd > 0) {
              const hasRange = Number.isFinite(maxUsd) && maxUsd > minUsd;
              return (
                <div className="text-center py-2">
                  <span className="text-4xl font-bold text-green-700">
                    {hasRange
                      ? `$${minUsd.toFixed(2)} - $${maxUsd.toFixed(2)} USD`
                      : `$${minUsd.toFixed(2)} USD`}
                  </span>
                  {Number.isFinite(avgUsd) && avgUsd > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Average variant price: ${avgUsd.toFixed(2)} USD
                    </p>
                  )}
                  {Number.isFinite(appliedMargin) && appliedMargin > 0 && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Applied margin: {appliedMargin.toFixed(0)}%
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Exact USD sell values from priced variants (same values sent to checklist/queue).
                  </p>
                </div>
              );
            } else {
              return (
                <p className="text-gray-500 italic text-center">Price unavailable</p>
              );
            }
          })()}
        </div>

      </div>
    </div>
  );
}
