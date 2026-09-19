import { describe, it, expect, vi } from "vitest";
import {
  parseOpenFoodFacts,
  OpenFoodFactsProvider,
} from "./providers/openFoodFactsProvider";
import { resolveBarcode } from "./barcodeService";
import { manualProduct } from "./productMetadata";
import { readProductCache, storedProduct } from "./productCache";
const barcode = "1234567890123";
describe("live product identity and local catalogue", () => {
  it("maps v3 metadata and keeps individual units separate from pack size", () => {
    const p = parseOpenFoodFacts(barcode, {
      status: "success",
      product: {
        code: barcode,
        product_name: "Pepsi Max",
        brands: "Pepsi",
        quantity: "24 x 330ml",
        image_front_url: "https://example.com/pepsi.jpg",
        categories: "Beverages, Soft drinks",
        categories_tags: ["en:beverages"],
        product_type: "food",
      },
    })!;
    expect(p.id).toBe("external-" + barcode);
    expect(p.packCount).toBe(24);
    expect(p.unitQuantity).toBe(330);
    expect(p.unit).toBeUndefined();
    expect(p.image).toBe("https://example.com/pepsi.jpg");
    expect(p.history).toEqual([]);
    expect(p.isSeeded).toBe(false);
  });
  it("accepts incomplete records without inventing brand, units or prices", () => {
    const p = parseOpenFoodFacts(barcode, {
      status: "success",
      product: { generic_name: "Coffee" },
    })!;
    expect(p.name).toBe("Coffee");
    expect(p.brand).toBeUndefined();
    expect(p.unitQuantity).toBeUndefined();
    expect(
      parseOpenFoodFacts(barcode, {
        status: "success",
        product: { brands: "Pepsi" },
      })?.name,
    ).toBe("");
    expect(
      parseOpenFoodFacts(barcode, {
        status: "failure",
        product: { product_name: "Bad" },
      }),
    ).toBeNull();
  });
  it("rejects wrong identities and unsafe image URLs", () => {
    expect(
      parseOpenFoodFacts(barcode, {
        status: "success",
        product: { code: "88888888", product_name: "Other" },
      }),
    ).toBeNull();
    expect(
      parseOpenFoodFacts(barcode, {
        status: "success",
        product: {
          product_name: "Safe",
          image_front_url: "javascript:alert(1)",
        },
      })?.image,
    ).toBeUndefined();
  });
  it("checks seeded then cached products before any external lookup", async () => {
    const provider = { id: "test", resolveBarcode: vi.fn() };
    expect(
      (await resolveBarcode("5449000054227", [], [provider])).product?.id,
    ).toBe("fanta");
    const p = manualProduct(barcode, "Coffee");
    expect((await resolveBarcode(barcode, [p], [provider])).product?.name).toBe(
      "Coffee",
    );
    expect(provider.resolveBarcode).not.toHaveBeenCalled();
  });
  it("falls through provider errors, and preserves lookup failure for manual recovery", async () => {
    const p = manualProduct(barcode, "Coffee");
    const bad = {
      id: "bad",
      resolveBarcode: vi.fn().mockRejectedValue(Error()),
    };
    const good = { id: "good", resolveBarcode: vi.fn().mockResolvedValue(p) };
    expect((await resolveBarcode(barcode, [], [bad, good])).product).toEqual(p);
    expect((await resolveBarcode(barcode, [], [bad])).message).toContain(
      "unavailable",
    );
  });
  it("uses v3 minimal fields and treats 404 as not found", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    try {
      expect(
        await new OpenFoodFactsProvider().resolveBarcode(barcode),
      ).toBeNull();
      const url = String(fetcher.mock.calls[0][0]);
      expect(url).toContain("/api/v3/product/");
      expect(url).toContain("fields=");
      expect(url).not.toContain("nutrition");
    } finally {
      fetcher.mockRestore();
    }
  });
  it("round-trips stable manual IDs and optional pack metadata", () => {
    const p = manualProduct(
      barcode,
      "Dish soap",
      "Brand",
      "6 x 500ml",
      "bottle",
    );
    expect(storedProduct(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("recovers valid records independently, migrates unversioned arrays and protects unknown versions", () => {
    const p = manualProduct(barcode, "Coffee");
    const load = (data: unknown) =>
      readProductCache({ getItem: () => JSON.stringify(data) });
    expect(load([p]).products).toHaveLength(1);
    expect(
      load({ version: 1, products: [p, { bad: true }, p] }).products,
    ).toHaveLength(1);
    expect(load({ version: 900, products: [p] }).readOnly).toBe(true);
    expect(readProductCache({ getItem: () => "{broken" }).readOnly).toBe(true);
  });
  it("keeps only identification fields in persisted products", () => {
    const p = storedProduct({
      ...manualProduct(barcode, "Coffee"),
      nutrition: {},
      history: [10],
      apiKey: "never",
      image: "http://unsafe/image",
    });
    expect(p).not.toHaveProperty("nutrition");
    expect(p).not.toHaveProperty("apiKey");
    expect(p?.history).toEqual([]);
    expect(p?.image).toBeUndefined();
  });
});
