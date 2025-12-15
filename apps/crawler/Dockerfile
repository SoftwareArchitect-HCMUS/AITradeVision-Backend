FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/crawler ./apps/crawler

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/crawler-service build

FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/crawler ./apps/crawler

# Install production dependencies only
# This ensures pnpm hoisting works correctly
RUN pnpm install --prod

# Copy built files
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/crawler/dist ./apps/crawler/dist

WORKDIR /app

CMD ["node", "apps/crawler/dist/main.js"]

