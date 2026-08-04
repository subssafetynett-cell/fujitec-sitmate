# Production frontend: build TanStack Start (Nitro) + nginx on :80
# Proxies /api → backend:4000 and SSR → node on :3000

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json bun.lock* ./
RUN npm ci || npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Same-origin /api via nginx — leave VITE_API_URL empty at build time
ENV VITE_API_URL=
ENV NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache nginx \
  && mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp /var/www/localhost/htdocs \
  && rm -f /etc/nginx/http.d/default.conf

COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000
ENV HOST=0.0.0.0
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
