import { offers, products, retailers } from "../data/catalogue";
import { optimise } from "./comparisonService";
import type { Offer } from "../models";
export interface RetailerAdapter {
  getOffers(productId: string): Promise<Offer[]>;
}
export const demoRetailerAdapter: RetailerAdapter = {
  async getOffers(id) {
    return offers.filter((o) => o.productId === id);
  },
};
export const searchProducts = (query: string) =>
  products.filter((p) =>
    `${p.name} ${p.category} ${p.brand}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
export function compare(
  id: string,
  desired: number,
  memberships: string[],
  maximum?: number,
) {
  return retailers
    .map((r) =>
      optimise(
        offers.filter(
          (o) =>
            o.productId === id &&
            (!o.loyalty || memberships.includes(o.loyalty)),
        ),
        r,
        desired,
        maximum,
      ),
    )
    .filter((r) => r !== null)
    .sort((a, b) => a.totalPence - b.totalPence || a.excess - b.excess);
}
