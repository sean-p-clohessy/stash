import { useEffect, useRef, useState } from "react";
import { Camera, Upload, ScanLine, ArrowRight, Check, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import type { Product } from "../models";
import { products } from "../data/catalogue";
import {
  decodeImage,
  resolveBarcode,
  type BarcodeResult,
} from "../services/barcodeService";
export default function Scan({
  onProduct,
  onSearch,
}: {
  onProduct: (p: Product) => void;
  onSearch: (name: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<BarcodeResult | null>(null);
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
    if (!/^\d{8,14}$/.test(value)) {
      setError("Enter an 8–14 digit product barcode.");
      return;
    }
    setCode(value);
    setBusy(true);
    const result = await resolveBarcode(value);
    if (mounted.current && token === generation.current) {
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
              <div className="panel scan-result">
                <div className="kicker accent">
                  <Check size={17} />
                  {found.name ? "FOUND IT" : "BARCODE CAPTURED"}
                </div>
                {found.image && (
                  <img
                    src={found.image}
                    alt={found.name}
                    className="external-product"
                    referrerPolicy="no-referrer"
                  />
                )}
                <h2>{found.name || "Give this product a name"}</h2>
                <p>Barcode: {found.barcode}</p>
                {found.message && <p>{found.message}</p>}
                {!found.productId && (
                  <label>
                    Product name
                    <input
                      value={found.name}
                      onChange={(e) =>
                        setFound({ ...found, name: e.target.value })
                      }
                    />
                  </label>
                )}
                <button
                  className="primary"
                  disabled={!found.name.trim()}
                  onClick={() =>
                    found.productId
                      ? onProduct(
                          products.find((p) => p.id === found.productId)!,
                        )
                      : onSearch(found.name)
                  }
                >
                  Find stock-up deals <ArrowRight size={17} />
                </button>
                {!found.productId && (
                  <p className="fineprint">
                    We’ll search our demo catalogue. Products outside it may not
                    have offers yet.
                  </p>
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
