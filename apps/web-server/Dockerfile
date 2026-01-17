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

# Rebuild native modules (bcrypt) to ensure they are built for Alpine Linux
RUN pnpm rebuild bcrypt || echo "bcrypt rebuild attempted"

# Build shared library and app
RUN pnpm --filter @shared/core build
RUN pnpm --filter @crypto/web-server build

FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (needed for rebuild)
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json ./
COPY libs ./libs
COPY apps/web-server ./apps/web-server

RUN npm install -g pnpm

RUN pnpm install --prod

# Copy node_modules from builder (includes built native modules)
COPY --from=builder /app/node_modules ./node_modules

# Rebuild native modules (bcrypt) for Alpine Linux in case they weren't built correctly
# Use npm rebuild directly in the bcrypt directory
RUN find /app/node_modules/.pnpm -name "bcrypt" -type d -path "*/bcrypt@*/node_modules/bcrypt" | head -1 | xargs -I {} sh -c 'cd {} && npm rebuild' || echo "bcrypt rebuild attempted"

# Copy built files
COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/web-server/dist ./apps/web-server/dist

WORKDIR /app/apps/web-server

EXPOSE 3000

CMD ["node", "dist/apps/web-server/src/main.js"]

