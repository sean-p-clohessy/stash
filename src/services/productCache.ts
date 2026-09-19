import { useState } from "react";
import type { Product } from "../models";
import { barcodeValid, cleanText, safeImage } from "./productMetadata";
export const PRODUCT_CACHE_KEY = "stash.discoveredProducts";
const VERSION = 1;
// An explicit allow-list prevents persisting unrelated provider payloads or nutrition data.
export function storedProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.barcode !== "string" ||
    !barcodeValid(v.barcode) ||
    !cleanText(v.name)
  )
    return null;
  if (
    v.isSeeded === true ||
    v.id !== `external-${v.barcode}` ||
    !cleanText(v.source)
  )
    return null;
  const p: Product = {
    id: `external-${v.barcode}`,
    barcode: v.barcode,
    name: cleanText(v.name)!,
    source: cleanText(v.source)!,
    isSeeded: false,
    history: [],
  };
  for (const key of [
    "brand",
    "variant",
    "genericName",
    "category",
    "measurement",
    "unit",
    "quantityText",
    "servingSize",
    "productType",
    "sourceProductId",
  ] as const)
    p[key] = cleanText(v[key]);
  for (const key of ["packCount", "unitQuantity"] as const)
    if (
      typeof v[key] === "number" &&
      Number.isFinite(v[key]) &&
      v[key] > 0 &&
      (key !== "packCount" || Number.isSafeInteger(v[key]))
    )
      p[key] = v[key];
  p.image = safeImage(v.image);
  if (Array.isArray(v.categories))
    p.categories = v.categories
      .map((x) => cleanText(x))
      .filter((x): x is string => !!x)
      .slice(0, 30);
  return p;
}
export function readProductCache(storage: Pick<Storage, "getItem">): {
  products: Product[];
  readOnly: boolean;
  warning: string;
} {
  try {
    const raw = storage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return { products: [], readOnly: false, warning: "" };
    const data = JSON.parse(raw);
    // Support a pre-versioned array as v0. Re-save in the v1 envelope on the next edit.
    const list = Array.isArray(data)
      ? data
      : data?.version === VERSION
        ? data.products
        : null;
    if (!Array.isArray(list))
      return {
        products: [],
        readOnly: true,
        warning:
          "This product cache uses an unsupported version. It has been kept intact; new products are session-only.",
      };
    const valid = list.map(storedProduct).filter((p): p is Product => !!p);
    return {
      products: [...new Map(valid.map((p) => [p.barcode, p])).values()],
      readOnly: false,
      warning:
        valid.length < list.length
          ? "Some saved product records could not be read. Your stock settings have been kept."
          : "",
    };
  } catch {
    return {
      products: [],
      readOnly: true,
      warning:
        "Saved products could not be read. New products will last for this session only.",
    };
  }
}
export function useDiscoveredProducts() {
  const [state, setState] = useState(() => {
    try {
      return readProductCache(localStorage);
    } catch {
      return {
        products: [] as Product[],
        readOnly: true,
        warning:
          "Browser storage is unavailable. New products will last for this session only.",
      };
    }
  });
  function cache(product: Product) {
    const clean = storedProduct(product);
    if (!clean) throw Error("Invalid discovered product");
    const next = [
      ...state.products.filter((p) => p.barcode !== clean.barcode),
      clean,
    ];
    let warning = state.warning;
    try {
      if (!state.readOnly) {
        localStorage.setItem(
          PRODUCT_CACHE_KEY,
          JSON.stringify({ version: VERSION, products: next }),
        );
        warning = "";
      }
    } catch {
      warning =
        "Storage is full or unavailable. This product is saved for this session only.";
    }
    setState({ ...state, products: next, warning });
    return clean;
  }
  return { discovered: state.products, cache, cacheWarning: state.warning };
}
