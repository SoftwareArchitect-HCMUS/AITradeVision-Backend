FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/crawler ./apps/crawler

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install 
# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/crawler-service build

FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/crawler ./apps/crawler

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod

# Copy built files
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/crawler/dist ./apps/crawler/dist

WORKDIR /app/apps/crawler

CMD ["node", "dist/main.js"]

