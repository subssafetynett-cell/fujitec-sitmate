FROM node:22-alpine AS base
WORKDIR /app

# Coolify often injects NODE_ENV=production as a build-arg/env, which would
# skip devDependencies (typescript) and break `npm run build` (exit 127).
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --include=dev

FROM base AS build
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
