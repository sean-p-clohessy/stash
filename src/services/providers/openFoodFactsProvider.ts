import type { Product } from "../../models";
import { cleanText, safeImage } from "../productMetadata";
import { parsePack } from "../packParser";
import type { ProductLookupProvider } from "./productLookupProvider";
export const OFF_FIELDS =
  "code,product_name,generic_name,brands,quantity,serving_size,image_front_url,image_front_small_url,categories,categories_tags,product_type";
export function parseOpenFoodFacts(
  barcode: string,
  data: unknown,
): Product | null {
  if (!data || typeof data !== "object") return null;
  const body = data as { status?: string; product?: Record<string, unknown> };
  if (
    !body.product ||
    !["success", "success_with_warnings", "success_with_errors"].includes(
      body.status || "",
    )
  )
    return null;
  const p = body.product;
  if (p.code && String(p.code) !== barcode) return null;
  const name = cleanText(p.product_name) || cleanText(p.generic_name);
  // A nameless record is still identified; Scan asks the user for the missing name.
  const quantityText = cleanText(p.quantity);
  const pack = parsePack(quantityText);
  const categories = Array.isArray(p.categories_tags)
    ? p.categories_tags
        .map((x) => cleanText(x))
        .filter((x): x is string => !!x)
        .slice(0, 30)
    : undefined;
  return {
    id: `external-${barcode}`,
    barcode,
    name: name || "",
    genericName: cleanText(p.generic_name),
    brand: cleanText(p.brands),
    category: cleanText(p.categories)?.split(",")[0].trim(),
    categories,
    quantityText,
    servingSize: cleanText(p.serving_size),
    productType: cleanText(p.product_type),
    image: safeImage(p.image_front_url) || safeImage(p.image_front_small_url),
    packCount: pack?.packCount,
    unitQuantity: pack?.individualUnitQuantity,
    measurement: pack?.measurement,
    source: "open-food-facts",
    sourceProductId: barcode,
    isSeeded: false,
    history: [],
  };
}
export class OpenFoodFactsProvider implements ProductLookupProvider {
  readonly id = "open-food-facts";
  async resolveBarcode(barcode: string) {
    const query = new URLSearchParams({
      fields: OFF_FIELDS,
      lc: "en",
      product_type: "all",
    });
    // Browser fetch cannot reliably override User-Agent. Use the normal browser UA;
    // a future server-side lookup can send Stash/0.2 (https://github.com/sean-p-clohessy/stash).
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}?${query}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw Error("Product provider unavailable");
    return parseOpenFoodFacts(barcode, await response.json());
  }
}
