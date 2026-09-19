import type { Product } from "../models";
import { parsePack } from "./packParser";
import { cleanText } from "./productMetadata";
import { optimise } from "./comparisonService";
export type PriceObservation = {
  id: number;
  barcode: string;
  pricePence: number;
  observedOn: string;
  locationId: number;
  store: string;
  location: string;
  pricePer?: string;
  discounted?: boolean;
  discountType?: string;
  quantityText?: string;
  sourceUrl: string;
};
export type ObservationResult = {
  observations: PriceObservation[];
  retrievedAt: string;
  truncated: boolean;
};
export interface ObservedPriceProvider {
  lookup(product: Product): Promise<ObservationResult>;
}
export function parseObservations(
  data: unknown,
  barcode: string,
  now = Date.now(),
): ObservationResult {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { items?: unknown }).items)
  )
    throw Error("Unexpected price response");
  const payload = data as { items: unknown[]; total?: number };
  const today = new Date(now).toISOString().slice(0, 10);
  const cutoff = new Date(now - 365 * 86400000).toISOString().slice(0, 10);
  const rows: PriceObservation[] = [];
  for (const raw of payload.items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, any>;
    const loc = r.location;
    if (
      r.product_code !== barcode ||
      r.currency !== "GBP" ||
      r.type !== "PRODUCT" ||
      r.duplicate_of != null ||
      !loc ||
      loc.type !== "OSM" ||
      String(loc.osm_address_country_code).toUpperCase() !== "GB"
    )
      continue;
    if (
      !Number.isSafeInteger(r.id) ||
      r.id <= 0 ||
      !Number.isSafeInteger(loc.id) ||
      loc.id <= 0 ||
      typeof r.price !== "number" ||
      !Number.isFinite(r.price) ||
      r.price <= 0 ||
      r.price > 1e6
    )
      continue;
    if (r.price_per != null && typeof r.price_per !== "string") continue;
    if (r.product?.code && r.product.code !== barcode) continue;
    const pence = Math.round(r.price * 100);
    if (Math.abs(r.price * 100 - pence) > 1e-6) continue;
    if (
      typeof r.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(Date.parse(r.date)) ||
      new Date(r.date).toISOString().slice(0, 10) !== r.date ||
      r.date > today ||
      r.date < cutoff
    )
      continue;
    const store = cleanText(loc.osm_name) || cleanText(loc.osm_brand);
    if (!store) continue;
    rows.push({
      id: r.id,
      barcode,
      pricePence: pence,
      observedOn: r.date,
      locationId: loc.id,
      store,
      location:
        cleanText(loc.osm_display_name, 500) ||
        [
          store,
          cleanText(loc.osm_address_city),
          cleanText(loc.osm_address_postcode),
        ]
          .filter(Boolean)
          .join(", "),
      pricePer: cleanText(r.price_per),
      discounted:
        typeof r.price_is_discounted === "boolean"
          ? r.price_is_discounted
          : undefined,
      discountType: cleanText(r.discount_type),
      quantityText: cleanText(r.product?.quantity),
      sourceUrl: `https://prices.openfoodfacts.org/prices/${r.id}`,
    });
  }
  // Keep the latest report for each physical shop. Never combine branches or dated prices.
  rows.sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.id - a.id);
  const latest = new Map<number, PriceObservation>();
  for (const row of rows)
    if (!latest.has(row.locationId)) latest.set(row.locationId, row);
  return {
    observations: [...latest.values()],
    retrievedAt: new Date(now).toISOString(),
    truncated:
      typeof payload.total === "number" && payload.total > payload.items.length,
  };
}
const requests = new Map<
  string,
  { expires: number; promise: Promise<ObservationResult> }
>();
export class OpenPricesProvider implements ObservedPriceProvider {
  async lookup(product: Product): Promise<ObservationResult> {
    // Seed barcode mappings are fixtures, not verified identifiers for their demo artwork.
    if (product.isSeeded)
      return {
        observations: [],
        retrievedAt: new Date().toISOString(),
        truncated: false,
      };
    const cached = requests.get(product.barcode);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const query = new URLSearchParams({
      product_code: product.barcode,
      currency: "GBP",
      order_by: "-date",
      page_size: "50",
      date__gte: new Date(Date.now() - 365 * 86400000)
        .toISOString()
        .slice(0, 10),
      date__lte: new Date().toISOString().slice(0, 10),
    });
    const promise = fetch(
      `https://prices.openfoodfacts.org/api/v1/prices?${query}`,
      { signal: AbortSignal.timeout(8000), credentials: "omit" },
    )
      .then(async (response) => {
        if (!response.ok) throw Error("Open Prices unavailable");
        return parseObservations(await response.json(), product.barcode);
      })
      .catch((error) => {
        requests.delete(product.barcode);
        throw error;
      });
    if (requests.size >= 100) requests.delete(requests.keys().next().value!);
    requests.set(product.barcode, { expires: Date.now() + 5 * 60000, promise });
    return promise;
  }
}
export function estimateObservation(
  row: PriceObservation,
  product: Product,
  quantity: number,
  now = Date.now(),
) {
  const pack = parsePack(row.quantityText);
  // Discount restrictions, weighted prices and old reports cannot support a repeat-pack estimate.
  if (
    row.discounted !== false ||
    row.pricePer ||
    Math.floor((now - Date.parse(row.observedOn)) / 86400000) > 30 ||
    !pack ||
    product.packCount !== pack.packCount ||
    product.unitQuantity !== pack.individualUnitQuantity ||
    product.measurement !== pack.measurement
  )
    return null;
  return optimise(
    [
      {
        id: String(row.id),
        productId: product.id,
        retailerId: String(row.locationId),
        title: product.name,
        packSize: pack.packCount,
        pricePence: row.pricePence,
        isLive: false,
        provider: "open-prices",
        availability: "unknown",
      },
    ],
    {
      id: String(row.locationId),
      name: row.store,
      color: "#00cce7",
      online: false,
      deliveryPence: 0,
    },
    quantity,
  );
}
