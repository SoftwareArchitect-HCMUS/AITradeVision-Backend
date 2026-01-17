FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/web-server ./apps/web-server

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/web-server build

FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (needed for bcrypt rebuild)
RUN apk add --no-cache python3 make g++

# Install pnpm in production stage
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/web-server ./apps/web-server

# Install production dependencies
RUN pnpm install --prod

# Force rebuild bcrypt for Alpine Linux - this is the key step
RUN cd /app && npm rebuild bcrypt --build-from-source

# Copy built files from builder
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/web-server/dist ./apps/web-server/dist

WORKDIR /app

EXPOSE 3000

CMD ["node", "apps/web-server/dist/apps/web-server/src/main.js"]
