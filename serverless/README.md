# Stash pricing API scaffold

This Worker is separate from the GitHub Pages frontend. It is **not deployed** and has no authorised price provider connected. No supermarket or Trolley.co.uk scraping is implemented.

From this directory, `npx wrangler dev` can run the scaffold locally. Deploy to your own Cloudflare account with `npx wrangler deploy` only when you choose to operate this service. Configure `ALLOWED_ORIGINS` for the frontend origins you actually use. CORS is not authentication or rate limiting.

## Frontend configuration

Set `VITE_STASH_API_URL=https://your-worker.example` at **build time**. It is a public URL, never a credential. Rebuild the frontend afterwards. For GitHub Actions, set the repository Actions variable `VITE_STASH_API_URL`. If absent, the app operates without this service.

## Contract

`GET /prices/product/:barcode?productId=:canonicalStashId`

Until a provider is connected, the Worker returns HTTP 200:

```json
{"status":"provider_not_configured","offers":[],"retailers":[]}
```

A future authorised adapter must return:

```json
{
  "status": "ok",
  "productId": "external-1234567890123",
  "currency": "GBP",
  "retailers": [{
    "id": "example", "name": "Example Retailer", "online": true,
    "deliveryPence": 399, "deliveryNote": "£3.99 delivery included"
  }],
  "offers": [{
    "id": "provider-example-24", "productId": "external-1234567890123",
    "retailerId": "example", "provider": "authorised-provider",
    "retailerProductId": "example-24", "productUrl": "https://example.com/item",
    "title": "Example product 24 × 330ml", "packSize": 24,
    "pricePence": 1200, "loyaltyPricePence": 1100, "loyaltyProgramme": "Clubcard",
    "availability": "in_stock", "retrievedAt": "2026-09-19T12:00:00Z", "isLive": true
  }]
}
```

The above is a schema example, **not an offer or live price**. Use actual retrieval timestamps, retailer IDs and provider provenance. An `ok` response with empty offers means the lookup succeeded with no offers; it does not silently substitute demo offers. A failed/unconfigured API falls back only for seeded products, with explicit labelling.

## Adapter responsibilities before returning prices

- Keep provider credentials in Worker secrets, never `VITE_*` variables or a checked-in file.
- Use only authorised APIs/feeds. Verify the variant, individual size and product identity. Do not match on names alone. The barcode may identify a multipack; `packSize` always counts the underlying units used by Stash inventory, not the number of outer multipacks. E.g. two cases of 24 cans is 48 units.
- Normalise integer GBP pence, optional member prices, availability and retrieval time. `pricePence` is the regular pack price; `loyaltyPricePence` is optional and must not exceed it. Unavailable or unknown-availability offers are excluded from optimisation.
- `deliveryPence` is a known charge once per retailer result, and `deliveryNote` describes the fulfilment conditions. Never send zero for an unknown charge. Minimum spends, tiered delivery, stock limits, multi-buy rules and shipping regions need modelling before returning those offers; this V1 optimiser cannot represent those conditions.
- Cache authorised responses server-side with an explicit TTL, retaining original `retrievedAt`. Add rate limiting/budgets and provider timeouts. The current unconfigured response is deliberately not cached.
- Validate all responses. The frontend rejects mismatched product IDs, malformed prices, duplicate offer IDs, non-GBP payloads and absent delivery/provenance data.

Price history is not invented or derived from demo observations for live offers. A later `/prices/product/:id/history` endpoint needs dated observations with explicit provenance and a compatible per-unit basis. It is intentionally not wired to the demo chart now.

Product identification currently calls Open Food Facts v3 from the browser. Browser User-Agent cannot reliably be overridden. If moved server-side later, send `User-Agent: Stash/0.2 (https://github.com/sean-p-clohessy/stash)` for those requests.
