import { useEffect, useRef, useState } from "react";
import { Camera, Upload, ScanLine, ArrowRight, Check, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import type { Product, StashItem } from "../models";
import { ProductArt } from "../components/ProductArt";
import {
  barcodeValid,
  manualProduct,
  packLabel,
  unitLabel,
} from "../services/productMetadata";
import {
  decodeImage,
  resolveBarcode,
  type BarcodeResult,
} from "../services/barcodeService";
export default function Scan({
  onProduct,
  discovered,
  onDiscovered,
  onSave,
  stash,
  onViewStash,
}: {
  onProduct: (p: Product) => void;
  discovered: Product[];
  onDiscovered: (product: Product) => Product;
  onSave: (product: Product) => void;
  stash: StashItem[];
  onViewStash: (id: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const resultPanel = useRef<HTMLDivElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<BarcodeResult | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    brand: "",
    quantity: "",
    unit: "",
  });
  const saved = found?.product
    ? stash.find((s) => s.productId === found.product!.id)
    : undefined;
  useEffect(() => {
    if (found) resultPanel.current?.scrollIntoView({ block: "start" });
  }, [found?.barcode, found?.product?.name]);
  function stop() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video.current) video.current.srcObject = null;
    setCamera(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      controls.current?.stop();
      const stream = video.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function lookup(value: string) {
    stop();
    const token = generation.current;
    setError("");
    setFound(null);
    if (!barcodeValid(value)) {
      setError("Enter an 8, 12, 13 or 14 digit product barcode.");
      return;
    }
    setCode(value);
    setBusy(true);
    const result = await resolveBarcode(value, discovered);
    if (mounted.current && token === generation.current) {
      if (result.product?.name && !result.product.isSeeded)
        result.product = onDiscovered(result.product);
      setDraft({
        name: result.product?.name || "",
        brand: result.product?.brand || "",
        quantity: result.product?.quantityText || "",
        unit: result.product?.unit || "",
      });
      setFound(result);
      setBusy(false);
    }
  }
  async function start() {
    stop();
    setError("");
    setFound(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera scanning isn’t available here. Use an HTTPS connection, upload a photo, or type the barcode below.",
      );
      return;
    }
    setCamera(true);
    const token = generation.current;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!mounted.current || token !== generation.current) return;
      const reader = new BrowserMultiFormatReader();
      const control = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video.current!,
        (result) => {
          if (result && token === generation.current)
            void lookup(result.getText());
        },
      );
      if (!mounted.current || token !== generation.current) control.stop();
      else controls.current = control;
    } catch {
      if (mounted.current && token === generation.current) {
        stop();
        setError(
          "We couldn’t open your camera. Check camera permission, or upload a clear barcode photo.",
        );
      }
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    stop();
    setFound(null);
    setError("");
    setBusy(true);
    const token = generation.current;
    try {
      const value = await decodeImage(file);
      if (mounted.current && token === generation.current) await lookup(value);
    } catch {
      if (mounted.current && token === generation.current) {
        setError(
          "No barcode found. Try a sharper photo with the whole barcode visible, or enter the numbers below.",
        );
        setBusy(false);
      }
    }
  }
  return (
    <div className="scan-page">
      <div className="page-heading">
        <div className="kicker muted">FROM YOUR CUPBOARD TO YOUR STASH</div>
        <h1>
          Scan it. Stash it<span className="accent">.</span>
        </h1>
        <p>Find your everyday favourite with a barcode.</p>
      </div>
      <div className="scan-layout">
        <section className="panel scanner">
          <div className="scanner-window">
            <video
              ref={video}
              muted
              playsInline
              className={camera ? "visible" : ""}
            />
            {!camera && (
              <>
                <ScanLine size={70} strokeWidth={1} />
                <h3>Good deals start here.</h3>
                <p>Point your camera at a product barcode.</p>
              </>
            )}
            <div className="scan-corner top-left" />
            <div className="scan-corner top-right" />
            <div className="scan-corner bottom-left" />
            <div className="scan-corner bottom-right" />
          </div>
          <button
            className="primary"
            onClick={camera ? stop : start}
            disabled={busy}
          >
            {camera ? <X size={18} /> : <Camera size={18} />}{" "}
            {camera ? "Stop camera" : "Scan barcode"}
          </button>
          <label className={`secondary upload ${busy ? "disabled" : ""}`}>
            <Upload size={18} />
            Upload barcode photo
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="fineprint">
            Camera access is only used while scanning. Photos are decoded on
            your device.
          </p>
        </section>
        <section>
          <div className="panel manual">
            <h3>Have the numbers handy?</h3>
            <p>Type the EAN or UPC printed below the barcode.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lookup(code.trim());
              }}
            >
              <label>
                Barcode number
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="e.g. 5449000054227"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="secondary" disabled={busy || !code.trim()}>
                Find product <ArrowRight size={17} />
              </button>
            </form>
            <button
              className="text-button demo-scan"
              disabled={busy}
              onClick={() => void lookup("5449000054227")}
            >
              Try the Fanta Zero demo barcode <ArrowRight size={14} />
            </button>
          </div>
          <div aria-live="polite">
            {busy && (
              <div className="panel scan-result">Looking for your product…</div>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {found && (
              <div className="panel scan-result" ref={resultPanel}>
                <div className="kicker accent">
                  <Check size={17} />
                  {found.product?.name ? "FOUND IT" : "BARCODE CAPTURED"}
                </div>
                {found.product?.name ? (
                  <>
                    <div className="scan-product-heading">
                      <ProductArt product={found.product} />
                      <div>
                        <h2>{found.product.name}</h2>
                        {found.product.brand && <p>{found.product.brand}</p>}
                        <p>{packLabel(found.product)}</p>
                      </div>
                    </div>
                    <p className="barcode-number">
                      Barcode <strong>{found.barcode}</strong>
                    </p>
                    {saved && (
                      <div className="recommendation good">
                        <strong>Already in My Stash</strong>
                        <p>
                          Current stock: {saved.current}{" "}
                          {unitLabel(found.product)}s
                        </p>
                      </div>
                    )}
                    <div className="scan-actions">
                      <button
                        className="primary"
                        onClick={() =>
                          saved
                            ? onViewStash(found.product!.id)
                            : onSave(found.product!)
                        }
                      >
                        {saved ? "View Stash item" : "Add to My Stash"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => onProduct(found.product!)}
                      >
                        Find prices <ArrowRight size={17} />
                      </button>
                    </div>
                    {found.product.source === "open-food-facts" && (
                      <p className="fineprint">
                        Product details from Open Food Facts. Retailer prices
                        are separate.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2>
                      {found.product
                        ? "One detail missing"
                        : "Make it part of your Stash"}
                    </h2>
                    <p className="barcode-number">
                      Barcode <strong>{found.barcode}</strong>
                    </p>
                    <p>
                      {found.message ||
                        "This product was recognised, but its name is missing. Add it below to continue."}
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const product = manualProduct(
                          found.barcode,
                          draft.name,
                          draft.brand,
                          draft.quantity,
                          draft.unit,
                        );
                        const cached = onDiscovered(
                          found.product
                            ? {
                                ...found.product,
                                ...product,
                                source: found.product.source,
                                image: found.product.image,
                                category: found.product.category,
                                categories: found.product.categories,
                                genericName: found.product.genericName,
                                servingSize: found.product.servingSize,
                                productType: found.product.productType,
                              }
                            : product,
                        );
                        setFound({ barcode: found.barcode, product: cached });
                      }}
                    >
                      <label>
                        Product name
                        <input
                          required
                          maxLength={300}
                          value={draft.name}
                          onChange={(e) =>
                            setDraft({ ...draft, name: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Brand (optional)
                        <input
                          maxLength={300}
                          value={draft.brand}
                          onChange={(e) =>
                            setDraft({ ...draft, brand: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Pack quantity (optional)
                        <input
                          placeholder="e.g. 6 × 500ml"
                          maxLength={300}
                          value={draft.quantity}
                          onChange={(e) =>
                            setDraft({ ...draft, quantity: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Count stock in
                        <select
                          value={draft.unit}
                          onChange={(e) =>
                            setDraft({ ...draft, unit: e.target.value })
                          }
                        >
                          <option value="">Items</option>
                          {[
                            "can",
                            "bottle",
                            "bar",
                            "bag",
                            "roll",
                            "tablet",
                            "capsule",
                            "pack",
                          ].map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}s
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="primary" disabled={!draft.name.trim()}>
                        Save product <Check size={17} />
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="fineprint attribution">
            External product details:{" "}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
            >
              Open Food Facts
            </a>{" "}
            · Open Database Licence. Demo products resolve locally.
          </p>
        </section>
      </div>
    </div>
  );
}
