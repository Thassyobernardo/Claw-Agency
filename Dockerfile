# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install deps first (cache layer)
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ .
RUN npm run build

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Standalone output + static assets + public folder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

EXPOSE 3000

CMD ["node", "server.js"]
