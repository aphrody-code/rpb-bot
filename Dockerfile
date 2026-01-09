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
COPY prisma.config.ts ./

# Generate Prisma Client (Custom Output)
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

# Build TypeScript to JS
RUN pnpm run build

# Copy generated client to dist
RUN mkdir -p dist/generated && cp -r src/generated/* dist/generated/

# ============================================
# Production stage
# ============================================
FROM base AS runner

ENV NODE_ENV=production
WORKDIR /app

# Copy package.json for runtime dependencies
COPY package.json ./

# Install runtime dependencies with npm (flat node_modules)
RUN npm install --omit=dev

# Copy built files (including generated client)
COPY --from=builder /app/dist ./dist

# Expose API port
EXPOSE 3001

# Run the compiled code
CMD ["node", "dist/index.js"]
