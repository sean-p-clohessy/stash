import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : undefined),
  headless: true,
});
const context = await browser.newContext();
let fail = false;
let requests = 0;
await context.route("https://prices.example.test/**", async (r) => {
  requests++;
  if (fail) return r.abort();
  const id = new URL(r.request().url()).searchParams.get("productId");
  if (id !== "fanta")
    return r.fulfill({
      json: { status: "provider_not_configured" },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  return r.fulfill({
    headers: { "Access-Control-Allow-Origin": "*" },
    json: {
      status: "ok",
      productId: id,
      currency: "GBP",
      retailers: [
        {
          id: "testshop",
          name: "Authorised Test Shop",
          online: true,
          deliveryPence: 399,
          deliveryNote: "£3.99 delivery included",
        },
      ],
      offers: [
        {
          id: "test24",
          productId: id,
          retailerId: "testshop",
          provider: "test-provider",
          retailerProductId: "sku24",
          title: "Fanta Zero 12 x 330ml",
          packSize: 12,
          pricePence: 600,
          loyaltyPricePence: 500,
          loyaltyProgramme: "Clubcard",
          availability: "in_stock",
          retrievedAt: new Date(Date.now() - 14 * 60000).toISOString(),
          isLive: true,
        },
      ],
    },
  });
});
const p = await context.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:5174");
await expect(p.locator(".card-retailer").first()).toContainText("Live");
await p.getByRole("textbox", { name: "Search products" }).fill("Fanta");
await p.locator(".product-open").click();
await expect(p.locator(".offer")).toHaveCount(1);
await expect(p.locator(".offer")).toContainText("Live price");
await expect(p.locator(".offer")).toContainText("£18.99");
await expect(p.locator(".offer")).toContainText("Updated 14 minutes ago");
await expect(p.locator(".history")).toContainText("No verified price history");
assert.equal(await p.locator(".history-chart").count(), 0);
await p.getByRole("button", { name: "Preferences", exact: true }).click();
await p.getByLabel("Tesco Clubcard").uncheck();
await expect(p.locator(".offer")).toContainText("£21.99");
await p.getByRole("button", { name: "Close preferences" }).click();
await p.screenshot({
  path: "artifacts/live-pricing-fixture.png",
  fullPage: true,
});
fail = true;
await p.reload();
await p.getByRole("textbox", { name: "Search products" }).fill("Fanta");
await p.locator(".product-open").click();
await expect(p.locator(".notice")).toContainText("temporarily unavailable");
await expect(p.locator(".offers-title")).toContainText("DEMO PRICES");
assert.ok((await p.locator(".offer").count()) > 1);
assert.deepEqual(errors, []);
console.log(
  "PASS: configured API renders live prices and retrieval time, applies loyalty and delivery, excludes demo history, and labels failed-provider fallback.",
);
await browser.close();
