# ─── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Accept API URL at build time and expose it to the Vite build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Serve with Nginx ─────────────────────────────────
FROM nginx:1.25-alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]