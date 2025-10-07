/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export default {
  async fetch(request) {
    // Build the target URL based on the incoming request path & query
    const url = new URL(request.url);
    const targetUrl = "https://api-pub.bitfinex.com" + url.pathname + url.search;

    // Forward request to Bitfinex with a friendly User-Agent
    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; bitfinex-proxy/1.0)"
      }
    });

    // Clone response and add CORS headers
    const newHeaders = new Headers(resp.headers);
    const allowedOrigins = [
      "https://staging.d35i2rc6wwis9c.amplifyapp.com",
      "https://regression.bonnemai.com",
      "http://localhost:8000/"
    ];

    const origin = request.headers.get("Origin");
    if (origin && allowedOrigins.includes(origin)) {
      newHeaders.set("Access-Control-Allow-Origin", origin);
      newHeaders.set("Access-Control-Allow-Credentials", "true");
    }

    newHeaders.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(await resp.arrayBuffer(), {
      status: resp.status,
      headers: newHeaders,
    });
  },
};