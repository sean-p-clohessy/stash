import { useEffect, useState } from "react";
import { ExternalLink, MapPin, RefreshCw } from "lucide-react";
import type { Product } from "../models";
import {
  OpenPricesProvider,
  estimateObservation,
  type ObservationResult,
} from "../services/openPricesService";
import { money, unitPrice } from "../services/comparisonService";
import { unitLabel } from "../services/productMetadata";
const provider = new OpenPricesProvider();
const dateLabel = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export function ReportedPrices({
  product,
  quantity,
  onScan,
}: {
  product: Product;
  quantity: number;
  onScan: () => void;
}) {
  const [result, setResult] = useState<ObservationResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError(false);
    if (product.isSeeded) return;
    setLoading(true);
    void provider
      .lookup(product)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product.id, attempt]);
  if (product.isSeeded)
    return (
      <div className="panel reported-seed">
        <div>
          <strong>Check a real pack’s reported prices</strong>
          <p>
            This sample uses a demo barcode mapping. Scan the barcode on your
            product to check the free UK price database.
          </p>
          <button className="text-button" onClick={onScan}>
            Scan your product
          </button>
        </div>
      </div>
    );
  return (
    <section className="reported-prices" aria-label="Reported UK store prices">
      <div className="section-heading offers-title">
        <h3>Reported UK store prices</h3>
        <span className="score good">Open Prices</span>
      </div>
      <p className="reported-intro">
        Prices shared by shoppers, tied to a specific shop and date. Price and
        stock today are unconfirmed.
      </p>
      <div aria-live="polite">
        {loading && <p className="price-status">Checking reported prices…</p>}
        {error && (
          <div className="notice">
            <div>
              <strong>Reported prices are temporarily unavailable.</strong>
              <p>Your product and stash are still saved.</p>
              <button
                className="text-button"
                onClick={() => setAttempt((n) => n + 1)}
              >
                <RefreshCw size={14} />
                Try again
              </button>
            </div>
          </div>
        )}
        {result && !result.observations.length && (
          <div className="panel observed-empty">
            <h3>No matching UK price reports yet</h3>
            <p>
              No usable GBP reports for this exact barcode were found in the
              latest records from the past year. Coverage depends on shopper
              contributions.
            </p>
          </div>
        )}
        {result?.observations.map((row) => {
          const estimate = estimateObservation(row, product, quantity);
          const age = Math.floor(
            (Date.now() - Date.parse(row.observedOn)) / 86400000,
          );
          return (
            <article className="panel observed-card" key={row.id}>
              <div className="section-heading">
                <h3>{row.store}</h3>
                <strong className="observed-price">
                  {money(row.pricePence)}
                  <small>
                    {row.pricePer
                      ? ` / ${row.pricePer.toLowerCase().replaceAll("_", " ")}`
                      : " / scanned pack"}
                  </small>
                </strong>
              </div>
              <p className="observed-location">
                <MapPin size={14} />
                {row.location}
              </p>
              <div className="observed-meta">
                <span>Observed {dateLabel(row.observedOn)}</span>
                <span>
                  {age > 30
                    ? "Older report · not used for estimates"
                    : "Reported price · unconfirmed today"}
                </span>
              </div>
              {row.quantityText && (
                <p className="fineprint">Reported pack: {row.quantityText}</p>
              )}
              {row.discounted && (
                <p className="discount-note">
                  Discounted price
                  {row.discountType
                    ? ` · ${row.discountType.toLowerCase().replaceAll("_", " ")}`
                    : ""}
                  . Eligibility and end date are unknown; excluded from
                  estimates.
                </p>
              )}
              {estimate ? (
                <div className="observation-estimate">
                  <strong>
                    Illustrative stock-up: {money(estimate.totalPence)}
                  </strong>
                  <span>
                    {estimate.items[0].count} packs · {estimate.units}{" "}
                    {unitLabel(product)}s · {unitPrice(estimate.unitPence)}/
                    {unitLabel(product)}
                  </span>
                  <p>
                    Assumes the same pack price is still available for every
                    pack. In-store only; stock and purchase limits are unknown.
                  </p>
                </div>
              ) : (
                !row.discounted &&
                age <= 30 && (
                  <p className="fineprint">
                    No stock-up estimate: the pack size or price basis cannot be
                    confirmed.
                  </p>
                )
              )}
              <a
                className="text-button"
                href={row.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                View price record <ExternalLink size={13} />
              </a>
            </article>
          );
        })}
      </div>
      <p className="fineprint reported-attribution">
        Source:{" "}
        <a
          href="https://prices.openfoodfacts.org/"
          target="_blank"
          rel="noreferrer"
        >
          Open Prices / Open Food Facts
        </a>{" "}
        ·{" "}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noreferrer"
        >
          ODbL
        </a>
        .
        {result &&
          ` Checked ${new Date(result.retrievedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}; observation dates are shown above.`}{" "}
        {result?.truncated &&
          "Showing latest matching shops from the 50 most recent records; this is not a complete market comparison."}
      </p>
    </section>
  );
}
