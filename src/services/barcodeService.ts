import type { Product } from "../models";
import { products } from "../data/catalogue";
import { OpenFoodFactsProvider } from "./providers/openFoodFactsProvider";
import {
  resolveFromProviders,
  type ProductLookupProvider,
} from "./providers/productLookupProvider";
import { barcodeValid } from "./productMetadata";
export type BarcodeResult = {
  barcode: string;
  product: Product | null;
  message?: string;
};
const providers: ProductLookupProvider[] = [new OpenFoodFactsProvider()];
export async function resolveBarcode(
  barcode: string,
  discovered: Product[] = [],
  chain = providers,
): Promise<BarcodeResult> {
  if (!barcodeValid(barcode))
    return {
      barcode,
      product: null,
      message: "Enter an 8, 12, 13 or 14 digit product barcode.",
    };
  const local =
    products.find((p) => p.barcode === barcode) ||
    discovered.find((p) => p.barcode === barcode);
  if (local) return { barcode, product: local };
  const result = await resolveFromProviders(barcode, chain);
  return {
    barcode,
    product: result.product,
    message: result.product
      ? undefined
      : result.failed
        ? "The product database is unavailable. Enter the details below to save this product yourself."
        : "This barcode isn’t in the product database yet. Add the details to teach your Stash.",
  };
}
type NativeDetector = {
  detect: (source: ImageBitmap) => Promise<{ rawValue: string }[]>;
};
export async function decodeImage(file: File) {
  const Detector = (
    window as unknown as {
      BarcodeDetector?: {
        new (options: { formats: string[] }): NativeDetector;
        getSupportedFormats: () => Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (Detector) {
    let bitmap: ImageBitmap | undefined;
    try {
      const formats = (await Detector.getSupportedFormats()).filter((f) =>
        ["ean_13", "ean_8", "upc_a", "upc_e"].includes(f),
      );
      if (formats.length) {
        bitmap = await createImageBitmap(file);
        const found = await new Detector({ formats }).detect(bitmap);
        if (found[0]) return found[0].rawValue;
      }
    } catch {
      /* Try portable decoder. */
    } finally {
      bitmap?.close();
    }
  }
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const url = URL.createObjectURL(file);
  try {
    return (
      await new BrowserMultiFormatReader().decodeFromImageUrl(url)
    ).getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}
