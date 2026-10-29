# AuditPilot — API server + statically built client in one container.
# Multi-stage: build client (vite) + bundle server (esbuild → dist/index.cjs),
# then run the bundle on a lean node image.

FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first (layer-cached on lock changes)
COPY package.json package-lock.json ./
RUN npm ci

# Build client + server (vite → dist/public, esbuild → dist/index.cjs)
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime deps only (the server bundle relies on external prod node_modules)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Built artifacts (server bundle + client assets served statically)
COPY --from=build /app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.cjs"]
