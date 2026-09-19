import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE || (process.platform === 'win32' ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : undefined),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/");
await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
await page.getByRole("textbox", { name: "Search products" }).fill("Fanta Zero");
await page.locator(".product-open").click();
await page.getByRole("button", { name: "30", exact: true }).click();
assert.equal(await page.locator(".offer").count(), 6);
assert.match(
  await page.locator(".best-offer").innerText(),
  /36 cans total|30 cans total/,
);
await page.getByRole("button", { name: "Add to My Stash" }).click();
await page.getByRole("button", { name: /My Stash/ }).click();
await page.getByText("Stock preferences", { exact: true }).click();
await page.getByLabel("Current stock", { exact: true }).fill("22");
await page.getByLabel("Target stock", { exact: true }).fill("48");
await page.getByRole("button", { name: "Consume one Fanta Zero" }).click();
assert.equal(await page.locator(".stock-counter strong").innerText(), "21");
await page.reload();
await page.getByRole("button", { name: /My Stash/ }).click();
assert.equal(await page.locator(".stock-counter strong").innerText(), "21");
await page.getByRole("button", { name: "Alerts", exact: true }).click();
await page.getByLabel("Alert below (pence / can)").fill("75");
await page.getByRole("switch").click();
assert.equal(
  await page.getByRole("switch").getAttribute("aria-checked"),
  "true",
);
await page.getByRole("button", { name: "Scan", exact: true }).click();
await page
  .getByRole("button", { name: "Try the Fanta Zero demo barcode" })
  .click();
await page.getByRole("button", { name: "Find stock-up deals" }).click();
assert.equal(await page.locator("h1").innerText(), "Fanta Zero");
await page.screenshot({ path: "artifacts/comparison.png", fullPage: true });
await page.getByRole("button", { name: "Custom", exact: true }).click();
await page.getByLabel("Units", { exact: true }).fill("40");
assert.match(await page.locator(".quantity-panel").innerText(), /at least 40/);
await page.getByRole("button", { name: "Preferences", exact: true }).click();
await page.getByLabel("Tesco Clubcard", { exact: true }).uncheck();
assert.equal(await page.locator(".offer").count(), 5);
await page.getByRole("button", { name: "Close preferences" }).click();
await page.getByRole("button", { name: "Search", exact: true }).click();
await page
  .getByRole("textbox", { name: "Search products" })
  .fill("nonexistent");
assert.equal(await page.getByText("No matches just yet").count(), 1);
await page.getByRole("button", { name: "Browse all essentials" }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "mobile overflow",
);
for (const name of ["Scan", "My Stash", "Alerts"]) {
  await page
    .locator("nav")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name} mobile overflow`,
  );
}
await page.getByRole("button", { name: "Search", exact: true }).click();
await page.locator(".product-open").first().click();
await page.screenshot({
  path: "artifacts/mobile-comparison.png",
  fullPage: true,
});
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "comparison mobile overflow",
);
assert.deepEqual(errors, []);
console.log(
  "PASS: search, quantity, comparisons, save, stock edits, persistence, alerts, barcode fixture, loyalty, empty search, mobile navigation and overflow. No browser errors.",
);
await browser.close();
