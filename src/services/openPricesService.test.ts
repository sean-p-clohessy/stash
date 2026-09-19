import { describe, it, expect, vi } from "vitest";
import {
  parseObservations,
  estimateObservation,
  OpenPricesProvider,
} from "./openPricesService";
import { manualProduct } from "./productMetadata";
import { products } from "../data/catalogue";
const now = Date.parse("2026-09-19T12:00:00Z");
const product = manualProduct(
  "1234567890123",
  "Drink",
  "Brand",
  "6 x 330ml",
  "can",
);
const row = (changes: Record<string, unknown> = {}) => ({
  id: 1,
  product_code: product.barcode,
  type: "PRODUCT",
  currency: "GBP",
  price: 3.5,
  date: "2026-09-18",
  duplicate_of: null,
  price_is_discounted: false,
  price_per: null,
  location: {
    id: 1,
    type: "OSM",
    osm_name: "Asda",
    osm_display_name: "Asda, Cardiff",
    osm_address_country_code: "GB",
  },
  product: { quantity: "6 x 330ml" },
  ...changes,
});
describe("Open Prices observations", () => {
  it("uses the exact barcode, currency, physical UK shop and observed date", () => {
    const result = parseObservations({ items: [row()] }, product.barcode, now);
    expect(result.observations[0]).toMatchObject({
      pricePence: 350,
      observedOn: "2026-09-18",
      location: "Asda, Cardiff",
    });
    expect(result.retrievedAt).toBe("2026-09-19T12:00:00.000Z");
  });
  it.each([
    { product_code: "99999999" },
    { currency: "EUR" },
    { date: "2026-12-01" },
    { date: "2025-01-01" },
    { date: "2026-02-31" },
    { price: -1 },
    { price: 3.555 },
    { duplicate_of: 10 },
    {
      location: {
        id: 1,
        type: "OSM",
        osm_name: "Shop",
        osm_address_country_code: "IE",
      },
    },
    {
      location: {
        id: 1,
        type: "ONLINE",
        osm_name: "Shop",
        osm_address_country_code: "GB",
      },
    },
  ])("filters unsafe or irrelevant rows %j", (change) => {
    expect(
      parseObservations({ items: [row(change)] }, product.barcode, now)
        .observations,
    ).toEqual([]);
  });
  it("deduplicates by shop using latest observation, not cheapest historical price", () => {
    const result = parseObservations(
      {
        items: [
          row({ id: 1, date: "2026-09-10", price: 1 }),
          row({ id: 2, price: 4 }),
        ],
        total: 60,
      },
      product.barcode,
      now,
    );
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].pricePence).toBe(400);
    expect(result.truncated).toBe(true);
  });
  it("estimates only compatible recent regular pack prices", () => {
    const r = parseObservations({ items: [row()] }, product.barcode, now)
      .observations[0];
    const estimate = estimateObservation(r, product, 30, now)!;
    expect(estimate.totalPence).toBe(1750);
    expect(estimate.units).toBe(30);
    expect(estimate.items[0].offer.isLive).toBe(false);
    for (const changed of [
      { ...r, discounted: true },
      { ...r, pricePer: "KILOGRAM" },
      { ...r, observedOn: "2026-06-01" },
      { ...r, quantityText: "12 x 330ml" },
      { ...r, quantityText: undefined },
    ])
      expect(estimateObservation(changed, product, 30, now)).toBeNull();
  });
  it("does not query fixture barcodes", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      expect(
        (await new OpenPricesProvider().lookup(products[0])).observations,
      ).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      fetcher.mockRestore();
    }
  });
  it("deduplicates concurrent calls and bounds freshness with a five-minute cache", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ items: [] })));
    try {
      const provider = new OpenPricesProvider();
      await Promise.all([provider.lookup(product), provider.lookup(product)]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(String(fetcher.mock.calls[0][0])).toContain(
        "product_code=1234567890123",
      );
    } finally {
      fetcher.mockRestore();
    }
  });
  it("rejects a malformed response", () => {
    expect(() => parseObservations({}, product.barcode, now)).toThrow();
  });
});
