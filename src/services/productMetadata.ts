import type { Product } from "../models";
import { parsePack } from "./packParser";
export const barcodeValid = (value: string) =>
  /^(?:\d{8}|\d{12,14})$/.test(value);
export function cleanText(value: unknown, limit = 300): string | undefined {
  return typeof value === "string"
    ? value.trim().slice(0, limit) || undefined
    : undefined;
}
export function safeImage(value: unknown): string | undefined {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function manualProduct(
  barcode: string,
  name: string,
  brand?: string,
  quantity?: string,
  unit?: string,
): Product {
  if (!barcodeValid(barcode) || !name.trim())
    throw Error("A barcode and product name are required.");
  const pack = parsePack(quantity);
  return {
    id: `external-${barcode}`,
    barcode,
    name: cleanText(name)!,
    brand: cleanText(brand),
    quantityText: cleanText(quantity),
    unit: cleanText(unit, 30),
    packCount: pack?.packCount,
    unitQuantity: pack?.individualUnitQuantity,
    measurement: pack?.measurement,
    source: "manual",
    sourceProductId: barcode,
    isSeeded: false,
    history: [],
  };
}
export const unitLabel = (product: Product) => product.unit || "item";
export function packLabel(p: Product) {
  if (p.unitQuantity && p.measurement)
    return `${p.packCount && p.packCount > 1 ? `${p.packCount} × ` : ""}${p.unitQuantity}${p.measurement}`;
  return p.quantityText || "Pack size unknown";
}
export const productMeta = (p: Product) =>
  [
    p.category || p.brand,
    p.quantityText || (p.unitQuantity ? packLabel(p) : undefined),
  ]
    .filter(Boolean)
    .join(" · ") || "Your essential";
