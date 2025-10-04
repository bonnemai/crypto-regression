# Bitfinex Reverse Proxy (Docker + NGINX)

This image exposes a local endpoint that forwards requests to the Bitfinex public API while injecting permissive CORS headers. Point your front-end at the proxy to avoid browser CORS rejections.

## Build

```bash
docker build -t bitfinex-proxy ./proxy
```

## Run

```bash
docker run --rm -p 8080:8080 bitfinex-proxy
```

The container listens on `http://localhost:8080` and proxies any request made to `/bitfinex/*`.

Example request:

```
GET http://localhost:8080/bitfinex/v2/candles/trade:1h:tETHUSD/hist?limit=5
```

That call is forwarded to `https://api-pub.bitfinex.com/v2/candles/trade:1h:tETHUSD/hist?limit=5` and the response contains `Access-Control-Allow-*` headers so browsers can consume it.

## Front-end integration

Update your fetch URL to point at the proxy, for example:

```js
const proxyBase = "http://localhost:8080/bitfinex";
const url = `${proxyBase}/v2/candles/trade:${resolution}:${symbol}/hist?limit=${limit}`;
```

Remember the proxy is intended for local development. For production deployments, host this container behind HTTPS (or replicate the approach using your infrastructure tooling) and add stricter `Access-Control-Allow-Origin` values if needed.
