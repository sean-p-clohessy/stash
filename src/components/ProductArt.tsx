import { useState, type CSSProperties } from "react";
import { Package } from "lucide-react";
import type { Product } from "../models";
export function ProductArt({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  if (product.image && failed !== product.image)
    return (
      <div className={`product-art photo-art ${large ? "large" : ""}`}>
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(product.image)}
        />
      </div>
    );
  if (!product.isSeeded)
    return (
      <div
        className={`product-art fallback-art ${large ? "large" : ""}`}
        aria-hidden="true"
      >
        <Package size={44} strokeWidth={1.25} />
      </div>
    );
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
