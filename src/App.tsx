import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Heart,
  Layers3,
  Minus,
  Package,
  Plus,
  ScanLine,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react";
import type { Product, StashItem } from "./models";
import { products, retailers } from "./data/catalogue";
import { compare, searchProducts } from "./services/productService";
import { money, score, unitPrice } from "./services/comparisonService";
import { useStored } from "./services/storage";
import { ProductArt } from "./components/ProductArt";
import Scan from "./pages/Scan";
type Page = "search" | "scan" | "stash" | "alerts";
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const validStash = (v: unknown): v is StashItem[] =>
  Array.isArray(v) &&
  v.every(
    (x) =>
      x &&
      products.some((p) => p.id === x.productId) &&
      ["current", "target", "monthly", "maximum", "alertPence"].every(
        (k) => Number.isFinite(x[k]) && x[k] >= 0,
      ) &&
      x.target >= 1 &&
      x.target <= 500 &&
      x.maximum >= x.target &&
      x.maximum <= 500 &&
      typeof x.alertEnabled === "boolean",
  );
export default function App() {
  const [page, setPage] = useState<Page>("search");
  const [selected, setSelected] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All essentials");
  const [quantity, setQuantity] = useState(30);
  const [custom, setCustom] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [toast, setToast] = useState("");
  const [stash, setStash, storageError] = useStored<StashItem[]>(
    "stash.items.v1",
    [],
    validStash,
  );
  const [recent, setRecent] = useStored<string[]>(
    "stash.recent.v1",
    [],
    strings,
  );
  const [memberships, setMemberships] = useStored<string[]>(
    "stash.memberships.v1",
    ["Clubcard", "Lidl Plus"],
    strings,
  );
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function navigate(next: Page) {
    setPage(next);
    setSelected(null);
    window.scrollTo(0, 0);
  }
  function open(product: Product) {
    setSelected(product);
    setPage("search");
    setQuantity(30);
    setCustom(false);
    setRecent(
      [product.id, ...recent.filter((id) => id !== product.id)].slice(0, 5),
    );
    window.scrollTo(0, 0);
  }
  function save(product: Product) {
    if (stash.some((s) => s.productId === product.id)) {
      setToast("Already in your stash");
      return;
    }
    setStash([
      ...stash,
      {
        productId: product.id,
        current: 0,
        target: 30,
        monthly: 30,
        maximum: 60,
        alertPence: Math.round(product.history[1] * 0.75),
        alertEnabled: false,
      },
    ]);
    setToast(`${product.name} added to your stash`);
  }
  function patch(id: string, values: Partial<StashItem>) {
    setStash(stash.map((s) => (s.productId === id ? { ...s, ...values } : s)));
  }
  const resultProducts = searchProducts(query).filter(
    (p) => category === "All essentials" || p.category === category,
  );
  const results = selected ? compare(selected.id, quantity, memberships) : [];
  const best = results[0];
  const history = selected && best ? score(selected, best.unitPence) : null;
  const nav = [
    { id: "search", name: "Search", icon: Search },
    { id: "scan", name: "Scan", icon: ScanLine },
    { id: "stash", name: "My Stash", icon: Layers3 },
    { id: "alerts", name: "Alerts", icon: Bell },
  ] as const;
  function productCard(p: Product) {
    const availableDeals = compare(p.id, 30, memberships);
    const deal = availableDeals[0];
    const grade = score(p, deal.unitPence);
    return (
      <article className="product-card" key={p.id}>
        <button
          className={`save-button icon-button ${stash.some((s) => s.productId === p.id) ? "saved" : ""}`}
          aria-label={`Save ${p.name}`}
          onClick={() => save(p)}
        >
          <Heart
            size={18}
            fill={
              stash.some((s) => s.productId === p.id) ? "currentColor" : "none"
            }
          />
        </button>
        <button className="product-open" onClick={() => open(p)}>
          <div className="art-well">
            <span className="saving">
              <ArrowDown size={12} />
              {Math.round(grade.below)}% vs typical
            </span>
            <ProductArt product={p} />
          </div>
          <div className="product-copy">
            <span className="eyebrow">
              {p.category} · {p.unitQuantity}
              {p.measurement}
            </span>
            <h3>{p.name}</h3>
            <div className="card-price">
              <strong>
                {unitPrice(deal.unitPence)}
                <small> / {p.unit}</small>
              </strong>
              <ArrowRight size={18} />
            </div>
            <div className="card-retailer">
              Best at {deal.retailer.name}
              <span>{availableDeals.length} retailers</span>
            </div>
          </div>
        </button>
      </article>
    );
  }
  return (
    <>
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => navigate("search")}
          aria-label="Stash home"
        >
          <span className="brand-icon">
            <Layers3 size={23} />
          </span>
          stash<span className="brand-dot">.</span>
        </button>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              {n.name}
              {n.id === "stash" && stash.length > 0 && (
                <span className="nav-count">{stash.length}</span>
              )}
            </button>
          ))}
        </nav>
        <button
          className="preferences-button"
          onClick={() => setPreferences(!preferences)}
          aria-expanded={preferences}
        >
          <SlidersHorizontal size={18} />
          <span>Preferences</span>
        </button>
      </header>
      {preferences && (
        <section className="preferences panel">
          <div className="section-heading">
            <h3>Your memberships</h3>
            <button
              className="icon-button"
              aria-label="Close preferences"
              onClick={() => setPreferences(false)}
            >
              <X size={20} />
            </button>
          </div>
          <p>Include member-only demo prices in comparisons.</p>
          {retailers
            .filter((r) => r.loyalty)
            .map((r) => (
              <label className="check-row" key={r.id}>
                <input
                  type="checkbox"
                  checked={memberships.includes(r.loyalty!)}
                  onChange={(e) =>
                    setMemberships(
                      e.target.checked
                        ? [...memberships, r.loyalty!]
                        : memberships.filter((m) => m !== r.loyalty),
                    )
                  }
                />
                {r.name} {r.loyalty}
              </label>
            ))}
        </section>
      )}
      <main>
        {page === "search" && !selected && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="kicker">
                  <span /> A LITTLE PLANNING. A BETTER PRICE.
                </div>
                <h1>
                  Stock up
                  <br />
                  <span>smarter.</span>
                </h1>
                <p>
                  Your everyday favourites. The best bulk buys.
                  <br className="desktop-break" /> Less spending, more in your
                  stash.
                </p>
              </div>
              <div className="hero-art">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="hero-product one">
                  <ProductArt product={products[2]} large />
                </div>
                <div className="hero-product two">
                  <ProductArt product={products[0]} large />
                </div>
                <div className="hero-product three">
                  <ProductArt product={products[1]} large />
                </div>
                <div className="floating-price">
                  <TrendingDown size={20} />
                  <div>
                    Small price. Big stash.<span>Make every pack count.</span>
                  </div>
                </div>
                <span className="art-plus plus-one">+</span>
                <span className="art-plus plus-two">+</span>
              </div>
            </section>
            <section className="search-section" aria-label="Find products">
              <div className="search-box">
                <Search size={23} />
                <input
                  aria-label="Search products"
                  placeholder="Try Fanta Zero, Monster Ultra, coffee pods…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={18} />
                  </button>
                )}
                <button
                  className="scan-shortcut"
                  onClick={() => navigate("scan")}
                  aria-label="Scan a barcode"
                >
                  <ScanLine size={23} />
                </button>
              </div>
              <div className="recent">
                <span>
                  {recent.length ? "Recent searches" : "Popular searches"}
                </span>
                {(recent.length
                  ? recent
                      .map((id) => products.find((p) => p.id === id))
                      .filter((p) => !!p)
                  : [products[0], products[1], products[2], products[6]]
                ).map((p) => (
                  <button key={p.id} onClick={() => open(p)}>
                    {p.name}
                    <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            </section>
            <section className="discover">
              <div className="section-heading">
                <div>
                  <div className="kicker muted">GOOD TIMING. GREAT PRICES.</div>
                  <h2>
                    {query ? "Find your next stock-up" : "Worth stashing today"}
                    <span className="small-spark">
                      <Sparkles size={20} />
                    </span>
                  </h2>
                  <p>
                    {query
                      ? `${resultProducts.length} matching essentials`
                      : "Good deals on the things you keep coming back to."}
                  </p>
                </div>
                <span className="demo-badge">
                  <span /> Demo prices
                </span>
              </div>
              <div className="categories">
                {["All essentials", "Drinks", "Snacks", "Household"].map(
                  (c) => (
                    <button
                      className={category === c ? "selected" : ""}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ),
                )}
                <span>Big on value. Low on effort.</span>
              </div>
              <div className="product-grid">
                {resultProducts.map(productCard)}
              </div>
              {!resultProducts.length && (
                <div className="empty panel">
                  <Search />
                  <h2>No matches just yet</h2>
                  <p>Try a brand like Fanta, or browse our demo essentials.</p>
                  <button
                    className="primary"
                    onClick={() => {
                      setQuery("");
                      setCategory("All essentials");
                    }}
                  >
                    Browse all essentials
                  </button>
                </div>
              )}
            </section>
            <div className="bottom-note">
              <Package size={20} />
              <div>
                <strong>Your favourites, always on hand.</strong>
                <span>Save an essential to start your personal stash.</span>
              </div>
              <button onClick={() => navigate("stash")}>
                Meet your stash <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {page === "search" && selected && (
          <>
            <button className="back" onClick={() => setSelected(null)}>
              <ArrowLeft size={16} />
              Back to discover
            </button>
            <section className="detail-header">
              <div className="detail-art">
                <ProductArt product={selected} />
              </div>
              <div>
                <div className="kicker muted">
                  {selected.category} / {selected.unitQuantity}
                  {selected.measurement}
                </div>
                <h1>{selected.name}</h1>
                <p>More of your favourite. For less.</p>
              </div>
              <button className="secondary" onClick={() => save(selected)}>
                {stash.some((s) => s.productId === selected.id) ? (
                  <Check size={18} />
                ) : (
                  <Plus size={18} />
                )}{" "}
                {stash.some((s) => s.productId === selected.id)
                  ? "In your stash"
                  : "Add to My Stash"}
              </button>
            </section>
            <div className="comparison-layout">
              <section>
                <div className="quantity-panel panel">
                  <div>
                    <h3>How much are you stashing?</h3>
                    <p>
                      We’ll find the lowest total for at least {quantity}{" "}
                      {selected.unit}s.
                    </p>
                  </div>
                  <div className="quantity-options">
                    {[12, 24, 30, 48].map((n) => (
                      <button
                        className={!custom && quantity === n ? "selected" : ""}
                        key={n}
                        onClick={() => {
                          setQuantity(n);
                          setCustom(false);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      className={custom ? "selected" : ""}
                      onClick={() => setCustom(true)}
                    >
                      Custom
                    </button>
                    {custom && (
                      <label>
                        Units
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(
                              Math.max(
                                1,
                                Math.min(500, Number(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="section-heading offers-title">
                  <h3>{results.length} ways to stock up</h3>
                  <span>Lowest total first</span>
                </div>
                {results.map((r, i) => (
                  <article
                    className={`offer panel ${i === 0 ? "best-offer" : ""}`}
                    key={r.retailer.id}
                  >
                    {i === 0 && (
                      <div className="best-label">
                        <Sparkles size={14} /> BEST STOCK-UP{" "}
                        <span>Lowest checkout total</span>
                      </div>
                    )}
                    <div className="offer-body">
                      <div className="retailer-line">
                        <span
                          className="retailer-logo"
                          style={{ color: r.retailer.color }}
                        >
                          {r.retailer.name.slice(0, 1)}
                        </span>
                        <h3>{r.retailer.name}</h3>
                        <span
                          className={`score ${score(selected, r.unitPence).tone}`}
                        >
                          {score(selected, r.unitPence).label}
                        </span>
                      </div>
                      <div className="offer-main">
                        <div>
                          {r.items.map((item) => (
                            <h4 key={item.offer.id}>
                              {item.count} × {item.offer.packSize}-pack{" "}
                              <span>{selected.name}</span>
                            </h4>
                          ))}
                          <p>
                            {r.units} {selected.unit}s total ·{" "}
                            {r.excess === 0
                              ? "Exactly your quantity"
                              : `${r.excess} extra ${selected.unit}s`}
                          </p>
                        </div>
                        <div className="offer-price">
                          <strong>{money(r.totalPence)}</strong>
                          <span>
                            {unitPrice(r.unitPence)} / {selected.unit}
                          </span>
                        </div>
                      </div>
                      <div className="offer-foot">
                        <span>
                          {r.items.some((x) => x.offer.loyalty)
                            ? `${r.items[0].offer.loyalty} required`
                            : "No membership needed"}
                        </span>
                        <span>
                          {r.retailer.deliveryPence
                            ? `${money(r.retailer.deliveryPence)} delivery included`
                            : "In-store price · delivery excluded"}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
                {!results.length && (
                  <div className="empty panel">
                    No eligible offers for this quantity. Try a smaller amount
                    or adjust your memberships.
                  </div>
                )}
                <p className="fineprint">
                  Illustrative offers, not live retailer prices. Pack
                  combinations stay within one retailer. In-store prices do not
                  include online delivery.
                </p>
              </section>
              <aside>
                {history && best && (
                  <>
                    <section className="panel history">
                      <div className="kicker">
                        <TrendingDown size={16} /> THE PRICE PICTURE
                      </div>
                      <h2>{Math.round(history.below)}% below typical</h2>
                      <p>A good time to top up your stash.</p>
                      <div
                        className="history-chart"
                        role="img"
                        aria-label={`12 demo weekly observations, typical ${unitPrice(history.average)}, lowest ${unitPrice(history.lowest)}`}
                      >
                        <svg viewBox="0 0 320 130">
                          <defs>
                            <linearGradient
                              id="chart-fill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop stopColor="#00cce7" stopOpacity=".2" />
                              <stop
                                offset="1"
                                stopColor="#00cce7"
                                stopOpacity="0"
                              />
                            </linearGradient>
                          </defs>
                          {[30, 65, 100].map((y) => (
                            <line
                              key={y}
                              x1="0"
                              x2="320"
                              y1={y}
                              y2={y}
                              stroke="#304565"
                              strokeDasharray="3 5"
                            />
                          ))}
                          <path
                            d={`M0,130 ${selected.history.map((v, i) => `L${i * 29},${115 - (v / Math.max(...selected.history)) * 90}`).join(" ")} L319,130Z`}
                            fill="url(#chart-fill)"
                          />
                          <polyline
                            points={selected.history
                              .map(
                                (v, i) =>
                                  `${i * 29},${115 - (v / Math.max(...selected.history)) * 90}`,
                              )
                              .join(" ")}
                            fill="none"
                            stroke="#00cce7"
                            strokeWidth="2.5"
                          />
                        </svg>
                        <div>
                          <span>12 weeks ago</span>
                          <span>Last observation</span>
                        </div>
                      </div>
                      <dl>
                        <div>
                          <dt>This stock-up</dt>
                          <dd className="accent">
                            {unitPrice(best.unitPence)}
                          </dd>
                        </div>
                        <div>
                          <dt>Typical price</dt>
                          <dd>{unitPrice(history.average)}</dd>
                        </div>
                        <div>
                          <dt>Lowest observed</dt>
                          <dd>{unitPrice(history.lowest)}</dd>
                        </div>
                      </dl>
                      <p className="fineprint">
                        Per {selected.unit}. Typical = mean of 12 seeded weekly
                        observations. Excellent: ≥20% below typical; good: ≥8%;
                        average: within 8%; expensive: above that.
                      </p>
                    </section>
                    <section className="panel saving-note">
                      <Sparkles size={21} />
                      <h3>Little wins add up.</h3>
                      <p>
                        This stock-up is{" "}
                        {money(
                          Math.max(
                            0,
                            history.average * best.units - best.totalPence,
                          ),
                        )}{" "}
                        less than buying {best.units} {selected.unit}s at the
                        typical price.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          save(selected);
                          navigate("alerts");
                        }}
                      >
                        Set a price alert <ArrowRight size={16} />
                      </button>
                    </section>
                  </>
                )}
              </aside>
            </div>
          </>
        )}
        {page === "scan" && (
          <Scan
            onProduct={open}
            onSearch={(name) => {
              setQuery(name);
              setCategory("All essentials");
              navigate("search");
            }}
          />
        )}
        {page === "stash" && (
          <>
            <PageHeading
              kicker="YOUR EVERYDAY, SORTED"
              title="My Stash"
              text="Keep your favourites close. Know when to top up."
            />
            <div className="section-heading">
              <span>{stash.length} saved essentials</span>
              <button className="secondary" onClick={() => navigate("search")}>
                <Plus size={17} />
                Add an essential
              </button>
            </div>
            {!stash.length && (
              <Empty
                icon={<Layers3 size={36} />}
                title="Make room for your favourites."
                text="Save the things you buy on repeat. A little less running out, a little more saving."
                action={() => navigate("search")}
                label="Find your first essential"
              />
            )}
            <div className="stash-grid">
              {stash.map((s) => {
                const p = products.find((p) => p.id === s.productId)!;
                const need = Math.max(1, s.target - s.current);
                const deal = compare(p.id, need, memberships, s.maximum)[0];
                const grade = deal ? score(p, deal.unitPence) : null;
                const worth =
                  deal &&
                  grade &&
                  grade.below >= 8 &&
                  s.current < Math.max(s.target, s.monthly / 2);
                return (
                  <article className="panel stash-card" key={s.productId}>
                    <div className="stash-card-top">
                      <ProductArt product={p} />
                      <div>
                        <span className="eyebrow">{p.category}</span>
                        <h3>{p.name}</h3>
                        <button className="text-button" onClick={() => open(p)}>
                          Compare prices <ChevronRight size={14} />
                        </button>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${p.name}`}
                        onClick={() =>
                          setStash(stash.filter((x) => x.productId !== p.id))
                        }
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="stock-counter">
                      <button
                        className="icon-button"
                        aria-label={`Consume one ${p.name}`}
                        onClick={() =>
                          patch(p.id, { current: Math.max(0, s.current - 1) })
                        }
                      >
                        <Minus size={20} />
                      </button>
                      <div>
                        <strong>{s.current}</strong>
                        <span>{p.unit}s left</span>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Add one ${p.name}`}
                        onClick={() =>
                          patch(p.id, {
                            current: Math.min(9999, s.current + 1),
                          })
                        }
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="stock-progress">
                      <span
                        style={{
                          width: `${Math.min(100, (s.current / s.target) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="stock-caption">
                      <span>Target: {s.target}</span>
                      <span>
                        {s.monthly
                          ? `${Math.round((s.current / s.monthly) * 30)} days at your usual pace`
                          : "Set consumption below"}
                      </span>
                    </div>
                    <div className={`recommendation ${worth ? "good" : ""}`}>
                      <strong>
                        {worth
                          ? "Worth stocking up"
                          : deal
                            ? "No rush"
                            : "No pack within your limit"}
                      </strong>
                      <p>
                        {worth && deal && grade
                          ? `From ${unitPrice(deal.unitPence)}/${p.unit}. Save about ${money(Math.max(0, grade.average * deal.units - deal.totalPence))} versus typical on ${deal.units} units.`
                          : deal
                            ? `Best ${unitPrice(deal.unitPence)}/${p.unit}. ${s.current >= s.target ? "You’re comfortably stocked." : "Wait for a better deal, or compare if you need it."}`
                            : "Increase your maximum purchase quantity to see a recommendation."}
                      </p>
                    </div>
                    <details>
                      <summary>Stock preferences</summary>
                      <div className="form-grid">
                        {(
                          [
                            ["current", "Current stock"],
                            ["target", "Target stock"],
                            ["monthly", "Monthly consumption"],
                            ["maximum", "Maximum purchase"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <input
                              type="number"
                              min={
                                key === "target" || key === "maximum" ? 1 : 0
                              }
                              max={key === "current" ? 9999 : 500}
                              value={s[key]}
                              onChange={(e) => {
                                const value = Math.min(
                                  key === "current" ? 9999 : 500,
                                  Math.max(
                                    key === "target" || key === "maximum"
                                      ? 1
                                      : 0,
                                    Math.round(Number(e.target.value) || 0),
                                  ),
                                );
                                patch(
                                  p.id,
                                  key === "target"
                                    ? {
                                        target: value,
                                        maximum: Math.max(value, s.maximum),
                                      }
                                    : key === "maximum"
                                      ? { maximum: Math.max(s.target, value) }
                                      : { [key]: value },
                                );
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {page === "alerts" && (
          <>
            <PageHeading
              kicker="A GOOD DEAL, ON YOUR TERMS"
              title="Price alerts"
              text="Choose your price. We’ll keep your preferences here."
            />
            <div className="notice">
              <Bell size={21} />
              <div>
                <strong>Saved here. Notifications aren’t active yet.</strong>
                <p>
                  This prototype checks demo prices while you browse. Email and
                  push notifications need a future backend.
                </p>
              </div>
            </div>
            {!stash.length && (
              <Empty
                icon={<Bell size={36} />}
                title="Your next good deal starts here."
                text="Add a product to My Stash, then choose the unit price you’d like to pay."
                label="Find an essential"
                action={() => navigate("search")}
              />
            )}
            <div className="alerts-list">
              {stash.map((s) => {
                const p = products.find((p) => p.id === s.productId)!;
                const deal = compare(p.id, s.target, memberships, s.maximum)[0];
                const hit = deal && deal.unitPence < s.alertPence;
                return (
                  <article className="panel alert-card" key={p.id}>
                    <ProductArt product={p} />
                    <div className="alert-name">
                      <h3>{p.name}</h3>
                      <p>
                        {deal
                          ? `Current demo best: ${unitPrice(deal.unitPence)} / ${p.unit}`
                          : "No pack combination within your limit"}
                      </p>
                      {s.alertEnabled && hit && (
                        <span className="score good">
                          Your target is met in demo prices
                        </span>
                      )}
                    </div>
                    <label>
                      Alert below (pence / {p.unit})
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={s.alertPence}
                        onChange={(e) =>
                          patch(p.id, {
                            alertPence: Math.min(
                              10000,
                              Math.max(1, Number(e.target.value) || 1),
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      role="switch"
                      aria-checked={s.alertEnabled}
                      aria-label={`Price alert for ${p.name}`}
                      className={`toggle ${s.alertEnabled ? "on" : ""}`}
                      onClick={() =>
                        patch(p.id, { alertEnabled: !s.alertEnabled })
                      }
                    >
                      <span />
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
      <footer>
        <span className="footer-brand">stash.</span>
        <span>A little more stocked. A little less spent.</span>
        <span>Prototype · Illustrative prices only</span>
      </footer>
      {(toast || storageError) && (
        <div className="toast" role="status">
          {storageError ? (
            "Storage unavailable. Changes last for this session only."
          ) : (
            <>
              <Check size={17} />
              {toast}
            </>
          )}
        </div>
      )}
    </>
  );
}
function PageHeading({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div className="kicker muted">{kicker}</div>
      <h1>
        {title}
        <span className="accent">.</span>
      </h1>
      <p>{text}</p>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  label,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  label: string;
  action: () => void;
}) {
  return (
    <div className="empty panel">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={action}>
        {label}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
