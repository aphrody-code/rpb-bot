# RPB Bot - Optimized Multi-stage Dockerfile
FROM node:24-slim AS base

# Install system dependencies (OpenSSL for Prisma, etc.)
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

# ============================================
# Builder stage
# ============================================
FROM base AS builder

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Generate Prisma Client
RUN pnpm exec prisma generate

# Build TypeScript to JS
RUN pnpm run build

# ============================================
# Production stage
# ============================================
FROM base AS runner

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

# Expose API port
EXPOSE 3001

# Run the compiled code
CMD ["node", "dist/index.js"]
