import { products } from "../data/catalogue";
export type BarcodeResult = {
  barcode: string;
  name: string;
  image?: string;
  productId?: string;
  message?: string;
};
export async function resolveBarcode(barcode: string): Promise<BarcodeResult> {
  const local = products.find((p) => p.barcode === barcode);
  if (local) return { barcode, name: local.name, productId: local.id };
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,image_front_small_url`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    if (data.status === 1 && data.product?.product_name)
      return {
        barcode,
        name: data.product.product_name,
        image: data.product.image_front_small_url,
      };
    return {
      barcode,
      name: "",
      message:
        "This barcode isn’t in the product database. Give it a name to search our catalogue.",
    };
  } catch {
    return {
      barcode,
      name: "",
      message:
        "The product database is unavailable. Your barcode is safe — enter a name to keep going.",
    };
  }
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
