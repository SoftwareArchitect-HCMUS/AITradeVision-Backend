FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/ai-service ./apps/ai-service

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/ai-service build

FROM node:20-alpine

WORKDIR /app

# Install pnpm in production stage
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/ai-service ./apps/ai-service

# Install production dependencies only
RUN pnpm install --prod

# Copy built files from builder
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/ai-service/dist ./apps/ai-service/dist

WORKDIR /app

EXPOSE 3001

CMD ["node", "apps/ai-service/dist/apps/ai-service/src/main.js"]
