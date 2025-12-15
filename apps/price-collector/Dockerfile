FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/price-collector ./apps/price-collector

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/price-collector-service build

FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/price-collector ./apps/price-collector

# Copy node_modules from builder (includes built native modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy built files
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/price-collector/dist ./apps/price-collector/dist

WORKDIR /app

CMD ["node", "apps/price-collector/dist/apps/price-collector/src/main.js"]

