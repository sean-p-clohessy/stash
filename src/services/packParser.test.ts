import { describe, expect, it } from "vitest";
import { parsePack } from "./packParser";
describe("defensive pack parsing", () => {
  it.each([
    ["330ml", 1, 330, "ml"],
    ["500 ml", 1, 500, "ml"],
    ["8 x 330 ml", 8, 330, "ml"],
    ["24 x 330ml", 24, 330, "ml"],
    ["6x500ml", 6, 500, "ml"],
    ["1.5L", 1, 1500, "ml"],
    ["6 × 0.5 L", 6, 500, "ml"],
    ["1,5 l", 1, 1500, "ml"],
    ["2 x 1kg", 2, 1000, "g"],
    ["33cl", 1, 330, "ml"],
    ["400 g e", 1, 400, "g"],
  ])("%s", (input, count, quantity, measurement) => {
    expect(parsePack(String(input))).toEqual({
      packCount: count,
      individualUnitQuantity: quantity,
      measurement,
    });
  });
  it.each([
    "",
    "a box",
    "24 cans",
    "2 x 3 x 330ml",
    "6 x 330ml (1980ml)",
    "330ml + 50ml",
    "0ml",
    "-1L",
    "0 x 500ml",
    "1.5 x 300ml",
    "4 servings",
    "6x500",
  ])("leaves ambiguous %s unknown", (input) => {
    expect(parsePack(input)).toBeUndefined();
  });
});
