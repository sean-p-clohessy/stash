import type { Offer, Product, Retailer, LiveOffer } from "../models";
import { safeImage, cleanText } from "./productMetadata";
export type PriceStatus = "ready" | "not_configured" | "unavailable";
export type PriceSnapshot = {
  status: PriceStatus;
  offers: Offer[];
  retailers: Retailer[];
  kind: "demo" | "live" | "none";
  message?: string;
};
export interface PriceProvider {
  searchProduct(product: Product): Promise<PriceSnapshot>;
}
const configuredUrl = import.meta.env.VITE_STASH_API_URL?.trim() || "";
export const pricingConfigured = !!configuredUrl;
const amount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 100000000;
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 500;
/** Strict boundary: identity, GBP, pack units, prices, availability and provenance must be explicit. */
export function parsePriceResponse(
  data: unknown,
  product: Product,
): PriceSnapshot {
  if (!data || typeof data !== "object") throw Error("Invalid price response");
  const d = data as Record<string, unknown>;
  if (d.status === "provider_not_configured")
    return {
      status: "not_configured",
      offers: [],
      retailers: [],
      kind: "none",
    };
  if (
    d.status !== "ok" ||
    d.productId !== product.id ||
    d.currency !== "GBP" ||
    !Array.isArray(d.offers) ||
    !Array.isArray(d.retailers)
  )
    throw Error("Invalid price response");
  const retailers: Retailer[] = d.retailers.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw Error("Invalid retailer");
    const r = raw as Record<string, unknown>;
    if (
      !text(r.id) ||
      !text(r.name) ||
      !amount(r.deliveryPence) ||
      !text(r.deliveryNote) ||
      typeof r.online !== "boolean"
    )
      throw Error("Missing retailer fulfilment terms");
    return {
      id: r.id,
      name: r.name,
      color: "#00cce7",
      online: r.online,
      deliveryPence: r.deliveryPence,
      deliveryNote: r.deliveryNote,
      loyalty: cleanText(r.loyalty),
    };
  });
  if (new Set(retailers.map((r) => r.id)).size !== retailers.length)
    throw Error("Duplicate retailer");
  const offers: LiveOffer[] = d.offers.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw Error("Invalid offer");
    const o = raw as Record<string, unknown>;
    if (
      !text(o.id) ||
      o.productId !== product.id ||
      !text(o.retailerId) ||
      !retailers.some((r) => r.id === o.retailerId) ||
      !text(o.title) ||
      !text(o.provider) ||
      !text(o.retailerProductId) ||
      !amount(o.packSize) ||
      o.packSize < 1 ||
      o.packSize > 1000 ||
      !amount(o.pricePence) ||
      o.pricePence < 1 ||
      o.isLive !== true ||
      !["in_stock", "out_of_stock", "unknown"].includes(
        String(o.availability),
      ) ||
      !text(o.retrievedAt) ||
      !Number.isFinite(Date.parse(o.retrievedAt)) ||
      Date.parse(o.retrievedAt) > Date.now() + 60000
    )
      throw Error("Invalid live offer");
    if (
      o.loyaltyPricePence !== undefined &&
      (!amount(o.loyaltyPricePence) ||
        o.loyaltyPricePence < 1 ||
        o.loyaltyPricePence > o.pricePence ||
        !text(o.loyaltyProgramme))
    )
      throw Error("Invalid loyalty offer");
    return {
      id: o.id,
      productId: product.id,
      retailerId: o.retailerId,
      title: o.title,
      packSize: o.packSize,
      pricePence: o.pricePence,
      provider: o.provider,
      retailerProductId: o.retailerProductId,
      productUrl: safeImage(o.productUrl),
      loyaltyPricePence: o.loyaltyPricePence as number | undefined,
      loyaltyProgramme: cleanText(o.loyaltyProgramme),
      availability: o.availability as LiveOffer["availability"],
      retrievedAt: o.retrievedAt,
      isLive: true,
    };
  });
  if (new Set(offers.map((o) => o.id)).size !== offers.length)
    throw Error("Duplicate offer");
  return { status: "ready", offers, retailers, kind: "live" };
}
export class StashPriceApi implements PriceProvider {
  constructor(private readonly baseUrl = configuredUrl) {}
  async searchProduct(product: Product): Promise<PriceSnapshot> {
    if (!this.baseUrl)
      return {
        status: "not_configured",
        offers: [],
        retailers: [],
        kind: "none",
      };
    const url = new URL(
      `${this.baseUrl.replace(/\/$/, "")}/prices/product/${encodeURIComponent(product.barcode)}`,
    );
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw Error("Pricing API must use HTTPS");
    url.searchParams.set("productId", product.id);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      credentials: "omit",
    });
    if (!response.ok) throw Error("Price service unavailable");
    return parsePriceResponse(await response.json(), product);
  }
}
export function updatedLabel(date?: string, now = Date.now()) {
  if (!date || !Number.isFinite(Date.parse(date)))
    return "Update time unavailable";
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  return minutes < 1
    ? "Updated just now"
    : minutes < 60
      ? `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`
      : minutes < 1440
        ? `Updated ${Math.floor(minutes / 60)} hours ago`
        : `Updated ${Math.floor(minutes / 1440)} days ago`;
}
