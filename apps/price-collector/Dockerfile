FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/price-collector ./apps/price-collector

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
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

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod

# Copy built files
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/price-collector/dist ./apps/price-collector/dist

WORKDIR /app/apps/price-collector

CMD ["node", "dist/main.js"]

