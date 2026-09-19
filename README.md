# Stash

[Open Stash](https://sean-p-clohessy.github.io/stash/)

A responsive, dark-first stock-up optimiser built with React, TypeScript and Vite. All retailer offers and historical observations are explicitly **demo data**, not current prices.

## Run

Requires Node.js 22+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` type-checks and produces `dist/`. `npm run preview` serves that production build. `npm test` runs the quantity engine tests.

`npm run test:browser` checks the main user journeys, mobile overflow, EAN image upload and error recovery against a running server on port 5173. The scripts use installed Microsoft Edge on Windows; on other systems, install Playwright Chromium with `npx playwright install chromium`. Set `BROWSER_EXECUTABLE` to override the browser path. Screenshots are saved in `artifacts/`. `npm run format` formats the source.

## Try it

1. Search Fanta Zero and choose 30 units, or a custom amount up to 500.
2. Compare retailer-specific mixed pack combinations, checkout totals and historical value.
3. Save the product to My Stash; adjust current stock and expand Stock preferences.
4. Set a per-unit price threshold in Alerts. Preferences persist locally; notifications are not sent.
5. Open Scan and try camera, image upload, manual entry, or the included demo barcode `5449000054227`.

Memberships can be changed from Preferences. Clubcard and Lidl Plus are selected for the demo initially. Removing a membership excludes offers requiring it.

## How the calculation works

The integer dynamic-programming engine in `src/services/comparisonService.ts` finds the lowest pack spend at or above the desired quantity for each retailer. Equal totals prefer fewer surplus units. Packs are never mixed across retailers. The search is bounded at desired quantity plus the largest pack minus one: with positive prices, larger combinations cannot improve the minimum total. A saved maximum purchase quantity is a hard cap for stock recommendations and alerts.

Prices use integer pence. Delivery is added once per retailer result; unit prices and savings include that cost. The demo uses in-store prices except Amazon, where the illustrated delivery fee is included. In-store totals exclude online delivery and basket minimums. These are not real checkout quotes.

Typical price is the arithmetic mean of 12 seeded observations per product. Excellent means at least 20% below typical, good at least 8%, average within 8%, and expensive above that band. Recommendations use stock, target, monthly consumption, maximum purchase and historical savings. They do not automatically consume stock.

## Structure

- `src/models`: canonical products, retailer metadata, normalised offers and local stock records.
- `src/data`: 14 illustrated essentials, six retailers, multiple pack sizes and seeded price histories. Product artwork is stylised CSS packaging, not official pack photography. Barcode mappings are prototype fixtures; validate against real product records before a live launch.
- `src/services/productService.ts`: catalogue search, comparison orchestration and an asynchronous retailer-adapter contract for future integrations.
- `src/services/comparisonService.ts`: pure quantity solver and historical comparison logic.
- `src/services/barcodeService.ts`: on-device image decode and product lookup.
- `src/services/storage.ts`: guarded, versioned localStorage persistence with session fallback.
- `src/pages/Scan.tsx`: camera lifecycle, upload, lookup and manual recovery.

## Barcode support

Image upload prefers native BarcodeDetector for supported EAN/UPC formats, then falls back to ZXing. Camera decoding uses ZXing and stops the camera on detection, cancellation or leaving Scan. Camera access requires HTTPS or localhost, a supported device and permission. Image quality and barcode format affect recognition. Real camera capture needs a physical-device check.

Unknown barcodes are looked up through [Open Food Facts](https://world.openfoodfacts.org), with an eight-second timeout and manual-name fallback. Only the barcode is sent; photos stay on device. External details are attributed to Open Food Facts (Open Database Licence); supplied images remain subject to their source licence. Recognising an external product does not create retailer offers: its name is searched against the demo catalogue.

## Static deployment

Deploy the contents of `dist/` to any static host. Vite uses `base: './'`, so assets work under a GitHub Pages repository subpath. Navigation uses local application state rather than server routes, so no rewrite configuration is needed. For GitHub Pages, use an Actions workflow that installs dependencies, builds and uploads `dist/` as a Pages artifact. No credentials or backend are required.

The included `.github/workflows/pages.yml` runs tests, builds, and deploys to GitHub Pages on every push to `main`. Repository Settings → Pages must use **GitHub Actions** as the build source. The workflow can also be run manually from Actions.

Fonts load from Google Fonts with system fallbacks. Everything except external barcode lookup and fonts works without external services after assets load. There is no authentication, checkout, tracking, push service, scraper or remote database.
