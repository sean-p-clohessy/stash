import { describe, it, expect } from "vitest";
import worker from "./worker.mjs";
describe("unconfigured pricing worker", () => {
  it("returns an honest unconfigured response and correct CORS", async () => {
    const r = await worker.fetch(
      new Request("https://example.com/prices/product/1234567890123", {
        headers: { Origin: "https://sean-p-clohessy.github.io" },
      }),
      {},
    );
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe("provider_not_configured");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://sean-p-clohessy.github.io",
    );
  });
  it("rejects disallowed origins and unsupported methods", async () => {
    expect(
      (
        await worker.fetch(
          new Request("https://example.com/prices/product/1234567890123", {
            headers: { Origin: "https://other.example" },
          }),
          {},
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          new Request("https://example.com/prices/product/1234567890123", {
            method: "POST",
          }),
          {},
        )
      ).status,
    ).toBe(405);
  });
});
