import type { Comparison, Offer, Product, Retailer } from "../models";
/** Integer dynamic programming, within one retailer. Prices are integer pence.
 * Minimise checkout spend, then excess. Never underfill; maximum is a hard cap. */
export function optimise(
  offers: Offer[],
  retailer: Retailer,
  desired: number,
  maximum = desired + Math.max(0, ...offers.map((o) => o.packSize)) - 1,
): Comparison | null {
  if (
    !Number.isInteger(desired) ||
    desired < 1 ||
    desired > 500 ||
    maximum < desired
  )
    return null;
  const valid = offers.filter(
    (o) =>
      o.retailerId === retailer.id &&
      Number.isInteger(o.packSize) &&
      o.packSize > 0 &&
      o.pricePence > 0,
  );
  const cap = Math.min(
    1000,
    maximum,
    desired + Math.max(0, ...valid.map((o) => o.packSize)) - 1,
  );
  const cost = Array(cap + 1).fill(Infinity);
  const prev: (Offer | undefined)[] = Array(cap + 1);
  cost[0] = 0;
  for (let q = 1; q <= cap; q++)
    for (const offer of valid)
      if (
        q >= offer.packSize &&
        cost[q - offer.packSize] + offer.pricePence < cost[q]
      ) {
        cost[q] = cost[q - offer.packSize] + offer.pricePence;
        prev[q] = offer;
      }
  let best = -1;
  for (let q = desired; q <= cap; q++)
    if (Number.isFinite(cost[q]) && (best === -1 || cost[q] < cost[best]))
      best = q;
  if (best === -1) return null;
  const counts = new Map<string, { offer: Offer; count: number }>();
  let q = best;
  while (q > 0) {
    const offer = prev[q]!;
    const item = counts.get(offer.id);
    counts.set(offer.id, { offer, count: (item?.count ?? 0) + 1 });
    q -= offer.packSize;
  }
  const totalPence = cost[best] + retailer.deliveryPence;
  return {
    retailer,
    items: [...counts.values()],
    units: best,
    totalPence,
    unitPence: totalPence / best,
    excess: best - desired,
  };
}
export function score(product: Product, price: number) {
  if (
    !product.history.length ||
    product.history.some((v) => !Number.isFinite(v) || v <= 0)
  )
    return null;
  const average =
    product.history.reduce((a, b) => a + b, 0) / product.history.length;
  const below = ((average - price) / average) * 100;
  return {
    average,
    lowest: Math.min(...product.history),
    below,
    label:
      below >= 20
        ? "Excellent stock-up"
        : below >= 8
          ? "Good price"
          : below >= -8
            ? "Average price"
            : "Expensive",
    tone: below >= 8 ? "good" : below >= -8 ? "average" : "expensive",
  };
}
export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100,
  );
export const unitPrice = (pence: number) =>
  pence < 100 ? `${Number(pence.toFixed(1))}p` : money(pence);
