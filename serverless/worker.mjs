/** Standalone Cloudflare Worker scaffold. No provider calls or scraping.
 * Bind authorised provider credentials as Worker secrets when implementing an adapter.
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "https://sean-p-clohessy.github.io")
      .split(",")
      .map((x) => x.trim());
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    };
    if (origin && !allowed.includes(origin))
      return new Response(JSON.stringify({ status: "origin_not_allowed" }), {
        status: 403,
        headers,
      });
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "GET")
      return new Response(JSON.stringify({ status: "method_not_allowed" }), {
        status: 405,
        headers: { ...headers, Allow: "GET, OPTIONS" },
      });
    const path = new URL(request.url).pathname;
    if (!/^\/prices\/product\/\d{8,14}$/.test(path))
      return new Response(JSON.stringify({ status: "not_found" }), {
        status: 404,
        headers,
      });
    return new Response(
      JSON.stringify({
        status: "provider_not_configured",
        offers: [],
        retailers: [],
      }),
      { headers },
    );
  },
};
