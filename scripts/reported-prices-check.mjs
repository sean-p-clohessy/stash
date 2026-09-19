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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let priceRequests = 0;
let fail = false;
await page.route("**/api/v3/product/**", (r) =>
  r.fulfill({
    json: {
      status: "success",
      product: {
        code: "1234567890123",
        product_name: "Test Sparkling Water",
        brands: "Test",
        quantity: "6 x 330ml",
      },
    },
  }),
);
await page.route("**prices.openfoodfacts.org/api/v1/prices?**", async (r) => {
  priceRequests++;
  if (fail) return r.abort();
  await r.fulfill({
    json: {
      total: 1,
      items: [
        {
          id: 55,
          product_code: "1234567890123",
          type: "PRODUCT",
          currency: "GBP",
          price: 3.5,
          date: new Date().toISOString().slice(0, 10),
          price_is_discounted: false,
          price_per: null,
          location: {
            id: 10,
            type: "OSM",
            osm_name: "Asda",
            osm_display_name: "Asda, Cardiff, CF10",
            osm_address_country_code: "GB",
          },
          product: { quantity: "6 x 330ml" },
        },
      ],
    },
  });
});
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: "Scan", exact: true }).click();
await page.getByLabel("Barcode number").fill("1234567890123");
await page.getByRole("button", { name: "Find product", exact: true }).click();
await page.getByRole("button", { name: "Find prices", exact: true }).click();
await expect(page.locator(".observed-card")).toContainText("£3.50");
await expect(page.locator(".observation-estimate")).toContainText("£17.50");
await expect(page.locator(".observed-card")).toContainText("unconfirmed today");
assert.equal(await page.locator(".offer").count(), 0);
await page.getByRole("button", { name: "48", exact: true }).click();
await expect(page.locator(".observation-estimate")).toContainText("£28.00");
assert.equal(priceRequests, 1);
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.screenshot({
  path: "artifacts/reported-prices-mobile.png",
  fullPage: true,
});
fail = true;
await page.reload();
await page
  .getByRole("textbox", { name: "Search products" })
  .fill("Test Sparkling");
await page.locator(".product-open").click();
await expect(page.locator(".reported-prices")).toContainText(
  "temporarily unavailable",
);
fail = false;
await page
  .locator(".reported-prices")
  .getByRole("button", { name: "Try again" })
  .click();
await expect(page.locator(".observed-card")).toBeVisible();
assert.deepEqual(errors, []);
console.log(
  "PASS: free reported prices, pack estimate, quantity changes without refetch, source separation, mobile overflow, API failure and retry.",
);
await browser.close();
