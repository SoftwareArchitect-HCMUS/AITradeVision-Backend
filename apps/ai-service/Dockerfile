FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/ai-service ./apps/ai-service

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install 
# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/ai-service build

FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs ./libs
COPY apps/ai-service ./apps/ai-service

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod

# Copy built files
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/ai-service/dist ./apps/ai-service/dist

WORKDIR /app/apps/ai-service

EXPOSE 3001

CMD ["node", "dist/main.js"]

