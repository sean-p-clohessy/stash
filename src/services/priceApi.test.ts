import { describe, it, expect, vi } from "vitest";
import { parsePriceResponse, StashPriceApi, updatedLabel } from "./priceApi";
import { compare, loadPrices } from "./productService";
import { manualProduct } from "./productMetadata";
import { products } from "../data/catalogue";
const p = manualProduct("1234567890123", "Test drink");
const data = () => ({
  status: "ok",
  currency: "GBP",
  productId: p.id,
  retailers: [
    {
      id: "shop",
      name: "Shop",
      online: true,
      deliveryPence: 399,
      deliveryNote: "£3.99 delivery included",
    },
  ],
  offers: [
    {
      id: "offer",
      productId: p.id,
      retailerId: "shop",
      provider: "authorised",
      retailerProductId: "sku",
      title: "12 pack",
      packSize: 12,
      pricePence: 600,
      loyaltyPricePence: 500,
      loyaltyProgramme: "Clubcard",
      availability: "in_stock",
      retrievedAt: new Date().toISOString(),
      isLive: true,
    },
  ],
});
describe("pricing provider boundary", () => {
  it("normalises live prices and applies eligible loyalty prices plus one delivery fee", () => {
    const snapshot = parsePriceResponse(data(), p);
    expect(compare(p.id, 24, [], undefined, snapshot)[0].totalPence).toBe(1599);
    const member = compare(p.id, 24, ["Clubcard"], undefined, snapshot)[0];
    expect(member.totalPence).toBe(1399);
    expect(member.items[0].offer.loyalty).toBe("Clubcard");
  });
  it("excludes unavailable offers", () => {
    const d = data();
    d.offers[0].availability = "out_of_stock";
    expect(compare(p.id, 12, [], undefined, parsePriceResponse(d, p))).toEqual(
      [],
    );
  });
  it.each([
    "identity",
    "currency",
    "negative",
    "fractional",
    "timestamp",
    "delivery",
    "duplicate",
    "provenance",
  ])("rejects invalid %s", (kind) => {
    const d = data();
    if (kind === "identity") d.productId = "wrong";
    if (kind === "currency") d.currency = "USD";
    if (kind === "negative") d.offers[0].pricePence = -1;
    if (kind === "fractional") d.offers[0].packSize = 1.5;
    if (kind === "timestamp") d.offers[0].retrievedAt = "invalid";
    if (kind === "delivery") d.retailers[0].deliveryPence = NaN;
    if (kind === "duplicate") d.offers.push(d.offers[0]);
    if (kind === "provenance") d.offers[0].isLive = false;
    expect(() => parsePriceResponse(d, p)).toThrow();
  });
  it("does not fetch when API configuration is absent", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      expect((await new StashPriceApi("").searchProduct(p)).status).toBe(
        "not_configured",
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it("falls back to explicit demo prices only for seeded products", async () => {
    const provider = { searchProduct: vi.fn().mockRejectedValue(Error()) };
    const seeded = await loadPrices(products[0], provider);
    expect(seeded.kind).toBe("demo");
    expect(seeded.offers.every((o) => o.isLive === false)).toBe(true);
    const external = await loadPrices(p, provider);
    expect(external.offers).toEqual([]);
    expect(external.status).toBe("unavailable");
  });
  it("does not replace a successful empty provider result with seeded prices", async () => {
    const provider = {
      searchProduct: vi
        .fn()
        .mockResolvedValue({
          status: "ready",
          offers: [],
          retailers: [],
          kind: "live",
        }),
    };
    expect((await loadPrices(products[0], provider)).offers).toEqual([]);
  });
  it("shows age from the retrieval timestamp", () => {
    expect(
      updatedLabel("2026-09-19T12:00:00Z", Date.parse("2026-09-19T12:14:00Z")),
    ).toBe("Updated 14 minutes ago");
  });
});
