"use client";

import type { ReactNode } from "react";
import { Package, TrendingUp, Layers, AlertTriangle, CheckCircle, XCircle, Globe, ShoppingBag } from "lucide-react";
import type { PricedProduct } from "./types";

type PreviewPageFourProps = {
  product: PricedProduct;
};

function getStockStatus(stock: number): { label: string; color: string; icon: ReactNode } {
  if (stock === 0) {
    return {
      label: "Out of Stock",
      color: "text-red-600 bg-red-50 border-red-200",
      icon: <XCircle className="h-5 w-5 text-red-500" />,
    };
  }
  if (stock < 10) {
    return {
      label: "Low Stock",
      color: "text-amber-600 bg-amber-50 border-amber-200",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    };
  }
  if (stock < 50) {
    return {
      label: "Limited Stock",
      color: "text-blue-600 bg-blue-50 border-blue-200",
      icon: <Package className="h-5 w-5 text-blue-500" />,
    };
  }
  return {
    label: "In Stock",
    color: "text-green-600 bg-green-50 border-green-200",
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
  };
}

function getPopularityLevel(listedNum: number): { label: string; level: number; color: string } {
  if (listedNum >= 1000) {
    return { label: "Very Popular", level: 5, color: "bg-green-500" };
  }
  if (listedNum >= 500) {
    return { label: "Popular", level: 4, color: "bg-emerald-500" };
  }
  if (listedNum >= 100) {
    return { label: "Moderate Popularity", level: 3, color: "bg-blue-500" };
  }
  if (listedNum >= 20) {
    return { label: "Low Popularity", level: 2, color: "bg-amber-500" };
  }
  return { label: "New", level: 1, color: "bg-gray-400" };
}

export default function PreviewPageFour({ product }: PreviewPageFourProps) {
  const detailedInventory = product.inventory;
  const totalStock = detailedInventory?.totalAvailable ?? product.stock;
  const cjStock = detailedInventory?.totalCJ ?? product.totalVerifiedInventory ?? 0;
  const factoryStock = detailedInventory?.totalFactory ?? product.totalUnVerifiedInventory ?? 0;
  const hasInventoryData = totalStock > 0 || cjStock > 0 || factoryStock > 0;
  
  const stockStatus = getStockStatus(totalStock);
  const popularity = getPopularityLevel(product.listedNum);
  
  const warehouses = detailedInventory?.warehouses || [];
  const hasWarehouses = warehouses.length > 0;
  
  // Use inventoryVariants for the blue Inventory Details box (contains ALL variant stock data)
  // This comes from queryVariantInventory API and includes all 54+ variants for multi-variant products
  const inventoryVariants = product.inventoryVariants || [];
  const hasInventoryVariants = inventoryVariants.length > 0;
  const inventoryVariantsCount = inventoryVariants.length;
  
  // Count variants with ACTUAL stock (> 0) - only these should be counted as "in stock"
  const variantsWithActualStock = inventoryVariants.filter(v => (v.cjStock > 0 || v.factoryStock > 0));
  const inStockCount = variantsWithActualStock.length;
  
  // Check for inventory fetch errors
  const inventoryHasError = product.inventoryStatus === 'error' || product.inventoryStatus === 'partial';
  const hasLegacyUnknownVariantStock = inventoryVariants.some(v => v.cjStock < 0 || v.factoryStock < 0);
  const hasUnknownVariantStock =
    hasLegacyUnknownVariantStock ||
    (inventoryVariantsCount === 0 && inventoryHasError && (totalStock > 0 || cjStock > 0 || factoryStock > 0));

  return (
    <div className="space-y-6">
      {inventoryHasError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Inventory Data Incomplete</p>
            <p className="text-sm text-amber-700 mt-1">
              {product.inventoryErrorMessage || 'Could not fetch complete inventory data from CJ. Stock values shown may not be accurate.'}
            </p>
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-5">
        <div className={`rounded-xl border p-5 ${stockStatus.color}`}>
          <div className="flex items-center gap-3 mb-4">
            {stockStatus.icon}
            <h3 className="text-lg font-bold">Stock Status</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Available:</span>
              <span className="text-2xl font-bold">{totalStock.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status:</span>
              <span className="font-semibold">{stockStatus.label}</span>
            </div>
            
            {hasInventoryData && (
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    🏭 CJ Warehouse:
                  </span>
                  <span className="font-semibold text-blue-600">{cjStock.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-500 flex items-center gap-1">
                    🏭 Factory:
                  </span>
                  <span className="font-semibold text-orange-600">{factoryStock.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Layers className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900">Variants</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Variants:</span>
              <span className="text-2xl font-bold text-gray-900">{product.totalVariants}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                {hasUnknownVariantStock ? 'Listed Variants:' : 'Available Variants:'}
              </span>
              <span className={`font-semibold ${hasUnknownVariantStock ? 'text-gray-600' : 'text-green-600'}`}>
                {hasUnknownVariantStock ? Math.max(inventoryVariantsCount, product.totalVariants) : inStockCount}
              </span>
            </div>

            {!hasUnknownVariantStock && product.totalVariants !== inStockCount && inStockCount > 0 && (
              <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-2">
                {product.totalVariants - inStockCount} variants out of stock or unavailable
              </div>
            )}
            
            {hasUnknownVariantStock && (
              <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-2">
                Per-variant stock data is unavailable from CJ. Product has {totalStock.toLocaleString()} total units.
              </div>
            )}
          </div>
        </div>
      </div>

      {hasWarehouses && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-bold text-gray-900">Inventory by Warehouse</h3>
          </div>
          
          <div className="max-h-60 overflow-y-auto overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Warehouse Location</th>
                  <th className="text-right py-2 px-3 font-semibold text-blue-600">
                    <span className="flex items-center justify-end gap-1">
                      🏭 CJ
                    </span>
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-orange-600">
                    <span className="flex items-center justify-end gap-1">
                      🏭 Factory
                    </span>
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((wh, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-gray-700">
                      {wh.areaName}
                      {wh.countryCode && <span className="text-gray-400 ml-1">({wh.countryCode})</span>}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-blue-600">
                      {wh.cjInventory.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-orange-600">
                      {wh.factoryInventory.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900">
                      {wh.totalInventory.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-900">Total</span>
              <div className="flex gap-6">
                <span className="text-blue-600">{cjStock.toLocaleString()}</span>
                <span className="text-orange-600">{factoryStock.toLocaleString()}</span>
                <span className="text-gray-900">{totalStock.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasInventoryVariants && (
        <div className="rounded-xl border-2 border-blue-400 overflow-hidden shadow-lg">
          <div className="bg-blue-600 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-5 w-5" />
              <h3 className="text-lg font-bold">Inventory Details</h3>
            </div>
            <span className={`text-sm px-3 py-1 rounded-full ${hasUnknownVariantStock ? 'bg-amber-500' : 'bg-blue-500'}`}>
              {hasUnknownVariantStock 
                ? `${inventoryVariantsCount} variants listed`
                : `${inStockCount} variants in stock`}
            </span>
          </div>
          
          <div className="bg-blue-50">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-blue-100 border-b-2 border-blue-300">
                  <tr>
                    <th className="text-left py-3 px-4 font-bold text-blue-900">Products</th>
                    <th className="text-right py-3 px-4 font-bold text-blue-900">Price</th>
                    <th className="text-right py-3 px-4 font-bold text-blue-700 border-l border-blue-300">
                      <span className="flex items-center justify-end gap-1">
                        🏭 CJ
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-bold text-blue-700">
                      <span className="flex items-center justify-end gap-1">
                        🏭 Factory
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {inventoryVariants.map((v, idx) => {
                    // Handle unknown per-variant stock (-1 means per-variant data not available)
                    const cjDisplay = v.cjStock < 0 ? '-' : v.cjStock.toLocaleString();
                    const factoryDisplay = v.factoryStock < 0 ? '-' : v.factoryStock.toLocaleString();
                    const isUnknownStock = v.cjStock < 0 || v.factoryStock < 0;
                    
                    return (
                      <tr key={idx} className="border-b border-blue-100 hover:bg-blue-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-blue-800">{v.shortName}</div>
                          <span className="text-blue-400 text-xs">SKU: {v.sku}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          ${(v.priceUSD || 0).toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold border-l border-blue-100 ${isUnknownStock ? 'text-gray-400' : 'text-blue-600'}`}>
                          {cjDisplay}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${isUnknownStock ? 'text-gray-400' : 'text-orange-500'}`}>
                          {factoryDisplay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 text-xs text-blue-700">
            <p><strong>CJ:</strong> Stock in CJ warehouse, ready for immediate shipping.</p>
            <p><strong>Factory:</strong> Stock at supplier. May require 1-3 days processing before shipping.</p>
            {hasUnknownVariantStock && (
              <p className="mt-2 text-amber-600">
                <strong>Note:</strong> Per-variant stock may be unavailable from CJ for this product. See total stock in "Stock Status" above.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-5">
          <TrendingUp className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-bold text-gray-900">Popularity</h3>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Number of stores selling this product:</span>
            <span className="text-xl font-bold text-gray-900">{product.listedNum.toLocaleString()}</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Popularity Level:</span>
              <span className="font-semibold">{popularity.label}</span>
            </div>
            
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`h-2 flex-1 rounded-full ${
                    level <= popularity.level ? popularity.color : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
            {popularity.level >= 4 ? (
              <>Popular and in high demand. There may be high competition.</>
            ) : popularity.level >= 2 ? (
              <>Moderate demand. Good opportunity to enter the market.</>
            ) : (
              <>New or low demand product. May need additional marketing.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
