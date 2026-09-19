import { offers, products, retailers } from "../data/catalogue";
import { optimise } from "./comparisonService";
import type { Offer, Product } from "../models";
import {
  StashPriceApi,
  type PriceProvider,
  type PriceSnapshot,
} from "./priceApi";
export interface RetailerAdapter {
  getOffers(productId: string): Promise<Offer[]>;
}
export const demoRetailerAdapter: RetailerAdapter = {
  async getOffers(id) {
    return offers.filter((o) => o.productId === id);
  },
};
export const searchProducts = (
  query: string,
  catalogue: Product[] = products,
) =>
  catalogue.filter((p) =>
    [
      p.name,
      p.category,
      p.brand,
      p.barcode,
      p.genericName,
      ...(p.categories || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
export function demoPrices(product: Product): PriceSnapshot {
  const matched = product.isSeeded
    ? offers.filter((o) => o.productId === product.id)
    : [];
  return {
    status: "not_configured",
    offers: matched,
    retailers: matched.length ? retailers : [],
    kind: matched.length ? "demo" : "none",
    message: "Live retailer pricing isn't connected yet.",
  };
}
export class DemoPriceProvider implements PriceProvider {
  async searchProduct(product: Product) {
    return demoPrices(product);
  }
}
const api = new StashPriceApi();
export async function loadPrices(
  product: Product,
  provider: PriceProvider = api,
): Promise<PriceSnapshot> {
  try {
    const live = await provider.searchProduct(product);
    if (live.status === "ready") return live;
    return { ...demoPrices(product), status: live.status };
  } catch {
    return {
      ...demoPrices(product),
      status: "unavailable",
      message:
        "Live retailer pricing is temporarily unavailable. Please try again later.",
    };
  }
}
export function compare(
  id: string,
  desired: number,
  memberships: string[],
  maximum?: number,
  snapshot?: PriceSnapshot,
) {
  const sourceOffers = snapshot?.offers ?? offers;
  const sourceRetailers = snapshot?.retailers ?? retailers;
  const eligible = sourceOffers
    .filter(
      (o) =>
        o.productId === id &&
        (!o.availability || o.availability === "in_stock") &&
        (!o.loyalty || memberships.includes(o.loyalty)),
    )
    .map((o) =>
      o.loyaltyPricePence &&
      o.loyaltyProgramme &&
      memberships.includes(o.loyaltyProgramme)
        ? { ...o, pricePence: o.loyaltyPricePence, loyalty: o.loyaltyProgramme }
        : o,
    );
  return sourceRetailers
    .map((r) => optimise(eligible, r, desired, maximum))
    .filter((r) => r !== null)
    .sort((a, b) => a.totalPence - b.totalPence || a.excess - b.excess);
}
