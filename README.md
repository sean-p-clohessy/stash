# Stash

[Open Stash](https://sean-p-clohessy.github.io/stash/)

React + TypeScript + Vite, deployed independently to GitHub Pages. Product identification is live through Open Food Facts v3. Retailer prices remain explicitly **demo data** until an authorised pricing API is connected.

## Run and verify

Requires Node.js 22+ and npm.

```sh
npm install
npm run dev
npm test
npm run build
```

`npm run preview` serves `dist/`. `npm run test:browser` checks the user journeys, mobile layout, EAN image upload, provider error recovery and discovered-product persistence against a running server on port 5173. Scripts use Microsoft Edge on Windows; on other systems run `npx playwright install chromium`. Set `BROWSER_EXECUTABLE` to override. Screenshots stay in ignored `artifacts/`. `npm run format` formats source.

## Product identification

Scan a barcode with the camera, upload a photo, or enter its digits. Lookup checks seeded records, then the discovered local catalogue, then the provider chain. A recognised product is cached with a stable `external-<barcode>` ID and can be viewed, searched, added to My Stash, assigned stock/consumption/target-price settings and rescanned locally after reopening the browser. No matching demo record is needed.

Unknown or failed lookups offer manual creation with name, optional brand, pack quantity and stock counting unit. A nameless provider record retains its known metadata and asks for the missing name. Manual products enter the same catalogue. Missing/broken images use a neutral icon. No fictional images, prices, brands, sizes or histories are added.

The [Open Food Facts v3 product endpoint](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/) is queried with a minimal field list and eight-second timeout. Only barcode and field/localisation options are sent; uploaded photos are decoded on device. Browser User-Agent cannot reliably be overridden, so the browser's normal header is used. A future server-side lookup should send `Stash/0.2 (https://github.com/sean-p-clohessy/stash)`.

External product data is attributed to Open Food Facts (Open Database Licence); supplied images remain subject to their source licence. The seeded Fanta demo barcode `5449000054227` and synthetic 990… mappings remain prototype fixtures and resolve before external providers. They should be validated before replacing the seeded catalogue with real canonical records.

## Pack and stock semantics

The defensive parser accepts explicit formats such as `330ml`, `24 × 330ml`, `6x500ml`, and `1.5L`. Litres/cl normalise to ml; kg to g. Outer pack count is separate from individual size: a 24 × 330ml record has `packCount:24` and `unitQuantity:330`. Ambiguous totals/servings/mixed packs stay unknown; the original quantity text is retained. Packaging type such as can/bottle is not inferred from volume.

Inventory counts underlying items (or the manually chosen unit), not outer multipacks or servings. Users can adjust current quantity, target, monthly consumption, maximum purchase and per-item target price. The existing maximum is a cap on the next purchase, not an automatic inventory ceiling. Alerts remain local preferences; push/email delivery is not active.

## Persistence

`stash.discoveredProducts` stores only identification metadata in a `{version:1,products:[...]}` envelope. Unversioned arrays migrate on the next write. Invalid entries are filtered individually; duplicate barcodes are deduplicated. Unsupported future versions or corrupt payloads are preserved without overwriting, with session-only fallback and a visible warning.

Existing `stash.items.v1`, recent-search and membership keys remain compatible. Stash rows with missing product metadata retain their stock settings and offer re-scanning. Storage quota/privacy failures remain usable for the session and are reported. Data is device/browser-local; it is not synced. Cached lookup works offline after page assets load, but this is not an installable offline PWA.

## Pricing and optimisation

The integer dynamic-programming engine minimises checkout spend within each retailer for at least the requested quantity. Equal totals prefer fewer surplus units. It can combine pack sizes, never mixes retailers and honours maximum purchase quantity. Positive prices permit a bound of requested quantity plus the largest pack minus one.

Prices are integer GBP pence. Delivery is added once; per-unit costs and savings include it. Demo offers use in-store prices except Amazon's illustrated delivery fee. Minimum baskets/tiered delivery and stock limits are not modelled; an authorised adapter must not return offers whose conditions cannot be represented.

Demo historical scoring is the mean of 12 seeded observations. Excellent means at least 20% below typical; good at least 8%; average within 8%; expensive above that band. **Live offers never use seeded history for savings or scores.** Discovered products have no fabricated history.

## Connecting an authorised price provider

Copy `.env.example` to `.env.local`, set the public `VITE_STASH_API_URL`, then restart/rebuild. Never put provider secrets in a `VITE_*` variable. On GitHub Actions, set the repository Actions variable `VITE_STASH_API_URL` and rerun the Pages workflow.

Without configuration the app remains fully usable: seeded products retain labelled **DEMO PRICES**, and discovered products say “Live retailer pricing isn't connected yet.” The asynchronous API and demo providers return normalised offers to the same optimiser. Configured API results appear across Search, comparisons, My Stash and Alerts. Regular/member prices respect memberships; retrieval ages are shown on live comparisons. Up to three API requests run concurrently per catalogue refresh. Comparison and stock changes do not trigger requests.

On API failure a visible notice explains the fallback; only seeded products receive demo offers. A successful empty response stays empty. Invalid currencies, identity mismatches, missing fulfilment/provenance data, malformed amounts, invalid timestamps and duplicate IDs are rejected.

See [serverless/README.md](serverless/README.md) for the separate Worker scaffold and exact contract. It returns `provider_not_configured` until an authorised integration is implemented. No service is provisioned or credentials required for this phase. No supermarket or Trolley.co.uk scraping is performed.

## Source structure

- `src/models`: canonical product metadata, stock records and normalised offers.
- `src/data/catalogue.ts`: seeded illustrations, prices and history.
- `src/services/providers`: extensible `ProductLookupProvider` chain and Open Food Facts v3 adapter.
- `src/services/productCache.ts`: versioned discovered-product persistence.
- `src/services/packParser.ts`: conservative unit/pack parser.
- `src/services/productService.ts`: combined search, demo/API orchestration and comparison entrypoint.
- `src/services/priceApi.ts`: async `PriceProvider`, API client and response validation.
- `src/hooks/usePricing.ts`: bounded catalogue price loading.
- `src/services/comparisonService.ts`: pure integer optimiser and history arithmetic.
- `src/pages/Scan.tsx`: preserved camera/upload lifecycle and improved product result flow.
- `serverless/`: independent Worker example, config, contract and tests.

## Camera and static deployment

Camera scanning requires HTTPS or localhost, device support and permission. ZXing is used for camera decoding; image upload prefers native supported EAN/UPC detection, with ZXing fallback. Camera streams stop on detection, cancellation or leaving Scan. Physical-device capture still requires device QA.

`.github/workflows/pages.yml` runs tests, builds and deploys `dist/` on pushes to `main`, or manually. Pages uses GitHub Actions as the source. Vite's relative asset base supports `/stash/`; state-based navigation requires no server rewrite. The frontend stays deployable without the separate pricing service.

Fonts load from Google Fonts with system fallbacks. There is no authentication, checkout, tracking, push service, scraper or remote database.

### Configured pricing UI check

`npm run test:pricing` targets a second local Vite server on port 5174 started with `VITE_STASH_API_URL=https://prices.example.test`. The browser test intercepts that host with fixtures; no retailer is queried. It checks live provenance, timestamps, membership prices, delivery totals and fallback labelling. These fixture results are not evidence of a connected real price provider.
