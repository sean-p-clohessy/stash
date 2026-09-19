import type { Product } from "../../models";
export interface ProductLookupProvider {
  readonly id: string;
  resolveBarcode(barcode: string): Promise<Product | null>;
}
export async function resolveFromProviders(
  barcode: string,
  providers: ProductLookupProvider[],
) {
  let failed = false;
  for (const provider of providers) {
    try {
      const product = await provider.resolveBarcode(barcode);
      if (product) return { product, failed };
    } catch {
      failed = true;
    }
  }
  return { product: null, failed };
}
