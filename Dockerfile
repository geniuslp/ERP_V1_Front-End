# ─── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time args. VITE_API_URL is only exposed to the build when non-empty.
ARG BASE_PATH=/erp/
ARG VITE_API_URL
ARG VITE_STORAGE_PREFIX=
ARG VITE_APP_ENV=prod

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN if [ -z "$VITE_API_URL" ]; then unset VITE_API_URL; else export VITE_API_URL; fi; \
    export VITE_BASE_PATH="$BASE_PATH" VITE_STORAGE_PREFIX VITE_APP_ENV; \
    NODE_OPTIONS=--max-old-space-size=1536 npm run build

# ─── Stage 2: Serve with Nginx ─────────────────────────────────
FROM nginx:1.25-alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
