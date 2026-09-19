import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE || (process.platform === 'win32' ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : undefined),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const R = L.map((x) => x.replace(/[01]/g, (v) => (v === "1" ? "0" : "1")));
const value = "5449000054227",
  parity = "LGGLLG";
const bits =
  "101" +
  [...value.slice(1, 7)]
    .map((n, i) => (parity[i] === "L" ? L : G)[Number(n)])
    .join("") +
  "01010" +
  [...value.slice(7)].map((n) => R[Number(n)]).join("") +
  "101";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="220" viewBox="0 0 120 55"><rect width="120" height="55" fill="white"/>${[...bits].map((v, i) => (v === "1" ? `<rect x="${i + 12}" y="5" width="1" height="40" fill="black"/>` : "")).join("")}</svg>`;
await page.setContent(svg);
await page.locator("svg").screenshot({ path: "artifacts/test-barcode.png" });
await page.goto("http://127.0.0.1:5173/");
await page.getByRole("button", { name: "Scan", exact: true }).click();
await page
  .locator("input[type=file]")
  .setInputFiles("artifacts/test-barcode.png");
await page.getByRole("button", { name: "Find stock-up deals" }).waitFor();
assert.match(await page.locator(".scan-result").innerText(), /Fanta Zero/);
await page.route("**/api/v2/product/**", (r) => r.abort());
await page.getByLabel("Barcode number").fill("1234567890123");
await page.getByRole("button", { name: "Find product", exact: true }).click();
await page
  .getByText("The product database is unavailable.", { exact: false })
  .waitFor();
await page.getByLabel("Product name", { exact: true }).fill("Pepsi Max");
await page.getByRole("button", { name: "Find stock-up deals" }).click();
assert.equal(await page.locator(".product-card").count(), 1);
await page.getByRole("button", { name: "Scan", exact: true }).click();
await page.getByLabel("Barcode number").fill("123");
await page.getByRole("button", { name: "Find product", exact: true }).click();
await page.getByRole("alert").waitFor();
assert.match(await page.getByRole("alert").innerText(), /8–14/);
await page.getByRole("button", { name: "Scan barcode", exact: true }).click();
await page.getByRole("alert").waitFor();
assert.match(await page.getByRole("alert").innerText(), /camera/);
await page.screenshot({ path: "artifacts/mobile-scan.png", fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.evaluate(() =>
  localStorage.setItem("stash.items.v1", '{"broken":true}'),
);
await page.reload();
await page.getByRole("button", { name: "My Stash", exact: true }).click();
assert.equal(await page.getByText("Make room for your favourites.").count(), 1);
console.log(
  "PASS: EAN-13 image upload decoded with ZXing, lookup failure/manual recovery, invalid barcode, camera unavailable, malformed storage recovery.",
);
await browser.close();
