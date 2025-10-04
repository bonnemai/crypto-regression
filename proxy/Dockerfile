FROM nginx:1.27-alpine

# Copy custom nginx configuration that proxies Bitfinex and injects CORS headers
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
