import type { CSSProperties } from "react";
import type { Product } from "../models";
export function ProductArt({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  return (
    <div
      className={`product-art ${large ? "large" : ""}`}
      style={{ "--product-color": product.color } as CSSProperties}
      aria-hidden="true"
    >
      <div className={`package ${product.art}`}>
        <span className="package-top" />
        <span className="package-brand">{product.brand}</span>
        <span className="package-variant">{product.variant || "ORIGINAL"}</span>
        <span className="package-size">
          {product.unitQuantity}
          {product.measurement}
        </span>
      </div>
      <div className="art-shadow" />
    </div>
  );
}
