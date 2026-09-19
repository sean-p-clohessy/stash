export type ParsedPack = {
  packCount: number;
  individualUnitQuantity: number;
  measurement: "ml" | "g";
};
/** Anchored grammar: ambiguous totals, serving counts and mixed packs remain unknown. */
export function parsePack(text?: string): ParsedPack | undefined {
  if (!text) return undefined;
  const match = text
    .trim()
    .match(
      /^(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)\s*(?:℮|e)?$/i,
    );
  if (!match) return undefined;
  const count = match[1] ? Number(match[1]) : 1;
  const value = Number(match[2].replace(",", "."));
  const unit = match[3].toLowerCase();
  const quantity =
    value * (unit === "l" || unit === "kg" ? 1000 : unit === "cl" ? 10 : 1);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 10000 ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 1e7
  )
    return undefined;
  return {
    packCount: count,
    individualUnitQuantity: Number(quantity.toFixed(6)),
    measurement: unit === "g" || unit === "kg" ? "g" : "ml",
  };
}
