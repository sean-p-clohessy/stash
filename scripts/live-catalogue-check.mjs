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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let requests = 0;
await context.route("**/api/v3/product/**", async (route) => {
  requests++;
  const code = new URL(route.request().url()).pathname.split("/").pop();
  const product =
    code === "1234567890123"
      ? {
          code,
          product_name: "Kitchen Pepsi Max",
          brands: "Pepsi",
          quantity: "24 x 330ml",
          image_front_url: "https://example.test/broken.jpg",
          categories: "Drinks",
        }
      : code === "88888888"
        ? { code, brands: "Incomplete Brand", quantity: "500 ml" }
        : null;
  await route.fulfill({
    status: product ? 200 : 404,
    json: { status: product ? "success" : "failure", product },
  });
});
await context.route("https://example.test/**", (r) =>
  r.fulfill({ status: 404, body: "" }),
);
await page.goto("http://127.0.0.1:5173/");
async function scan(code) {
  await page
    .locator("nav")
    .getByRole("button", { name: "Scan", exact: true })
    .click();
  await page.getByLabel("Barcode number").fill(code);
  await page.getByRole("button", { name: "Find product", exact: true }).click();
  await expect(page.locator(".scan-result")).toBeVisible();
}
await scan("1234567890123");
await expect(
  page.getByRole("heading", { name: "Kitchen Pepsi Max", exact: true }),
).toBeVisible();
await expect(page.getByText("24 × 330ml", { exact: true })).toBeVisible();
await expect(page.locator(".fallback-art")).toBeVisible();
await page
  .getByRole("button", { name: "Add to My Stash", exact: true })
  .click();
await expect(
  page.getByText("Already in My Stash", { exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "View Stash item" }).click();
await page.getByText("Stock preferences", { exact: true }).click();
await page.getByLabel("Current stock", { exact: true }).fill("12");
await page.getByLabel("Target stock", { exact: true }).fill("48");
await page.getByLabel("Maximum purchase", { exact: true }).fill("96");
await page.getByLabel("Monthly consumption", { exact: true }).fill("24");
await page
  .getByLabel("Target price (pence / item)", { exact: true })
  .fill("75");
await page.reload();
await page
  .getByRole("textbox", { name: "Search products" })
  .fill("Kitchen Pepsi");
await expect(page.locator(".product-card")).toHaveCount(1);
await page.locator(".product-open").click();
await expect(page.locator(".empty")).toContainText(
  "Live retailer pricing isn't connected yet.",
);
assert.ok(
  !(await page.locator("main").innerText()).match(/NaN|undefined|Infinity/),
);
await scan("1234567890123");
await expect(
  page.getByText("Current stock: 12 items", { exact: true }),
).toBeVisible();
assert.equal(requests, 1, "repeat scan must resolve locally");
await page.screenshot({
  path: "artifacts/live-scan-mobile.png",
  fullPage: true,
});
await scan("77777777");
await page
  .getByLabel("Product name", { exact: true })
  .fill("My dishwasher tablets");
await page.getByLabel("Brand (optional)").fill("Kitchen brand");
await page.getByLabel("Pack quantity (optional)").fill("30 tablets");
await page.getByLabel("Count stock in").selectOption("tablet");
await page.getByRole("button", { name: "Save product", exact: true }).click();
await page
  .getByRole("button", { name: "Add to My Stash", exact: true })
  .click();
await scan("88888888");
await expect(
  page.getByRole("heading", { name: "One detail missing" }),
).toBeVisible();
await expect(page.getByLabel("Brand (optional)")).toHaveValue(
  "Incomplete Brand",
);
await page
  .getByLabel("Product name", { exact: true })
  .fill("Unnamed cupboard product");
await page.getByRole("button", { name: "Save product", exact: true }).click();
const storage = await context.storageState();
await context.close();
const reopened = await browser.newContext({
  storageState: storage,
  viewport: { width: 1440, height: 1000 },
});
const q = await reopened.newPage();
await q.goto("http://127.0.0.1:5173/");
await q.getByRole("textbox", { name: "Search products" }).fill("dishwasher");
await expect(q.locator(".product-card")).toHaveCount(1);
await q
  .locator("nav")
  .getByRole("button", { name: /My Stash/ })
  .click();
await expect(q.locator(".stash-card")).toHaveCount(2);
await q.getByText("Stock preferences", { exact: true }).first().click();
await expect(q.getByLabel("Target stock", { exact: true }).first()).toHaveValue(
  "48",
);
await expect(
  q.getByLabel("Maximum purchase", { exact: true }).first(),
).toHaveValue("96");
await q.screenshot({
  path: "artifacts/live-stash-desktop.png",
  fullPage: true,
});
await q
  .locator("nav")
  .getByRole("button", { name: "Alerts", exact: true })
  .click();
await expect(q.getByLabel("Alert below (pence / item)")).toHaveValue("75");
assert.deepEqual(errors, []);
console.log(
  "PASS: v3 discovery, broken image fallback, save/stock/alert edits, no-price view, local repeat scan, manual creation, incomplete records and browser-reopen persistence.",
);
await browser.close();
