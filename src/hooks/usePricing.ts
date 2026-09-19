import { useEffect, useState } from "react";
import type { Product } from "../models";
import { demoPrices, loadPrices } from "../services/productService";
import { pricingConfigured, type PriceSnapshot } from "../services/priceApi";
/** Fetch on catalogue changes, not stock/quantity edits. Arithmetic remains synchronous. */
export function usePricing(products: Product[]) {
  const [prices, setPrices] = useState<Record<string, PriceSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const ids = products.map((p) => p.id).join("|");
  useEffect(() => {
    if (!pricingConfigured) return;
    let cancelled = false;
    setLoading(true);
    // Limit concurrent requests when a user has a larger local catalogue.
    let next = 0;
    const worker = async () => {
      while (next < products.length) {
        const product = products[next++];
        const result = await loadPrices(product);
        if (!cancelled)
          setPrices((prev) => ({ ...prev, [product.id]: result }));
        else break;
      }
    };
    void Promise.all(
      Array.from({ length: Math.min(3, products.length) }, worker),
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Product identity changes when a newly scanned record is cached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, refresh]);
  return {
    pricing: (product: Product) => prices[product.id] || demoPrices(product),
    loading,
    retry: () => setRefresh((n) => n + 1),
  };
}
