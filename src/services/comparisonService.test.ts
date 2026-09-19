import { describe, expect, it } from "vitest";
import { optimise, score } from "./comparisonService";
import { compare } from "./productService";
import { products } from "../data/catalogue";
import type { Offer, Retailer } from "../models";
const retailer: Retailer = {
  id: "test",
  name: "Test",
  color: "#fff",
  online: false,
  deliveryPence: 0,
};
const offer = (packSize: number, pricePence: number): Offer => ({
  id: String(packSize),
  productId: "test",
  retailerId: "test",
  title: "Test",
  packSize,
  pricePence,
});
describe("quantity optimisation", () => {
  it("combines different pack sizes to beat repeated single packs", () => {
    const result = optimise(
      [offer(12, 500), offer(18, 700), offer(24, 1000), offer(30, 1200)],
      retailer,
      40,
    )!;
    expect(result.totalPence).toBe(1700);
    expect(result.units).toBe(42);
    expect(result.items).toHaveLength(2);
  });
  it("never underfills and prefers less excess on equal spend", () => {
    const result = optimise([offer(12, 500), offer(18, 500)], retailer, 24)!;
    expect(result.units).toBe(24);
    expect(result.totalPence).toBe(1000);
  });
  it("includes delivery exactly once", () => {
    const result = optimise(
      [offer(12, 500)],
      { ...retailer, deliveryPence: 399 },
      30,
    )!;
    expect(result.totalPence).toBe(1899);
    expect(result.unitPence).toBe(1899 / 36);
  });
  it("respects maximum quantity and rejects invalid input", () => {
    expect(optimise([offer(24, 1000)], retailer, 30, 40)).toBeNull();
    expect(optimise([], retailer, 30)).toBeNull();
    expect(optimise([offer(12, 500)], retailer, 0)).toBeNull();
    expect(optimise([offer(12, 500)], retailer, 1.5)).toBeNull();
  });
  it("excludes unowned loyalty offers", () => {
    expect(
      compare("fanta", 30, []).some((r) => r.retailer.id === "tesco"),
    ).toBe(false);
    expect(
      compare("fanta", 30, ["Clubcard"]).some((r) => r.retailer.id === "tesco"),
    ).toBe(true);
  });
  it("matches brute force for a range of small quantities", () => {
    const list = [offer(3, 140), offer(5, 210), offer(8, 310)];
    for (let target = 1; target <= 35; target++) {
      let cost = Infinity;
      let units = Infinity;
      for (let a = 0; a <= 14; a++)
        for (let b = 0; b <= 9; b++)
          for (let c = 0; c <= 6; c++) {
            const q = a * 3 + b * 5 + c * 8;
            const price = a * 140 + b * 210 + c * 310;
            if (
              q >= target &&
              q < target + 8 &&
              (price < cost || (price === cost && q < units))
            ) {
              cost = price;
              units = q;
            }
          }
      const actual = optimise(list, retailer, target)!;
      expect(actual.totalPence).toBe(cost);
      expect(actual.units).toBe(units);
    }
  });
  it("computes historical comparisons transparently", () => {
    const result = score({ ...products[0], history: [40, 60] }, 35);
    expect(result.average).toBe(50);
    expect(result.lowest).toBe(40);
    expect(result.below).toBe(30);
    expect(result.label).toBe("Excellent stock-up");
  });
});
