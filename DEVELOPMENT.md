# Development Guide - Chạy Local

Hướng dẫn chạy các services trên local machine để development (không dùng Docker).

## Prerequisites

1. **Node.js** >= 18.0.0
2. **pnpm** >= 8.0.0
3. **PostgreSQL** (cho main database)
4. **TimescaleDB** (cho time-series data) - hoặc dùng PostgreSQL với extension
5. **Redis** 
6. **Qdrant** (vector DB)
7. **MinIO** (object storage)

## Setup Infrastructure

### Option 1: Chạy Infrastructure bằng Docker (Recommended)

Chỉ chạy infrastructure services bằng Docker, còn NestJS services chạy local:

```bash
# Start chỉ infrastructure
docker compose up -d redis postgres_main timescaledb qdrant minio

# Kiểm tra services đã sẵn sàng
docker compose ps
```

### Option 2: Cài đặt Local

- **PostgreSQL**: https://www.postgresql.org/download/
- **TimescaleDB**: https://docs.timescale.com/install/latest/
- **Redis**: https://redis.io/download
- **Qdrant**: https://qdrant.tech/documentation/guides/installation/
- **MinIO**: https://min.io/download

## Setup Project

### 1. Install Dependencies

```bash
# Install tất cả dependencies cho workspace
pnpm install
```

### 2. Build Shared Library

```bash
# Build shared library trước
pnpm --filter @shared/core build

# Hoặc watch mode để auto-rebuild
pnpm --filter @shared/core start:dev
```

### 3. Setup Environment Variables

Đảm bảo file `.env` đã được tạo với các giá trị:

```bash
# Database connections (nếu chạy local)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=crypto_user
POSTGRES_PASSWORD=crypto_pass
POSTGRES_DB=crypto_main

TIMESCALE_HOST=localhost
TIMESCALE_PORT=5432
TIMESCALE_USER=timescale_user
TIMESCALE_PASSWORD=timescale_pass
TIMESCALE_DB=timescale_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# JWT
JWT_SECRET=your-secret-key-change-in-production

# Gemini API
GEMINI_API_KEY=your-gemini-api-key-here
```

## Chạy Services

### Cách 1: Chạy từng service trong terminal riêng

Mở **4 terminal windows** và chạy:

**Terminal 1 - Crawler Service:**
```bash
cd "/Users/admin/Documents/Nhom nganh may tinh va cong nghe thong tin/Fourth year/First Semester/Software Architect/FinalProject"
pnpm --filter @crypto/crawler-service start:dev
```

**Terminal 2 - Price Collector Service:**
```bash
cd "/Users/admin/Documents/Nhom nganh may tinh va cong nghe thong tin/Fourth year/First Semester/Software Architect/FinalProject"
pnpm --filter @crypto/price-collector-service start:dev
```

**Terminal 3 - Web Server:**
```bash
cd "/Users/admin/Documents/Nhom nganh may tinh va cong nghe thong tin/Fourth year/First Semester/Software Architect/FinalProject"
pnpm --filter @crypto/web-server start:dev
```

**Terminal 4 - AI Service:**
```bash
cd "/Users/admin/Documents/Nhom nganh may tinh va cong nghe thong tin/Fourth year/First Semester/Software Architect/FinalProject"
pnpm --filter @crypto/ai-service start:dev
```

### Cách 2: Dùng pnpm workspace để chạy tất cả

```bash
# Chạy tất cả services cùng lúc (trong cùng terminal)
pnpm start:dev

# Hoặc chạy từng service riêng
pnpm --filter @crypto/crawler-service start:dev
pnpm --filter @crypto/price-collector-service start:dev
pnpm --filter @crypto/web-server start:dev
pnpm --filter @crypto/ai-service start:dev
```

### Cách 3: Dùng concurrently (nếu cài)

```bash
# Install concurrently globally
npm install -g concurrently

# Chạy tất cả services
concurrently \
  "pnpm --filter @crypto/crawler-service start:dev" \
  "pnpm --filter @crypto/price-collector-service start:dev" \
  "pnpm --filter @crypto/web-server start:dev" \
  "pnpm --filter @crypto/ai-service start:dev"
```

## Ports

Các services sẽ chạy trên các ports sau:

- **Crawler Service**: Port 3002
- **Price Collector Service**: Port 3003
- **Web Server**: Port 3000
- **AI Service**: Port 3001

## Test Services

### Web Server API

```bash
# Register user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### AI Service

```bash
# Get AI insights
curl http://localhost:3001/ai/insights?symbol=BTCUSDT
```

## Troubleshooting

### Lỗi: Cannot connect to database

- Kiểm tra PostgreSQL/TimescaleDB đang chạy
- Kiểm tra connection string trong `.env`
- Test connection: `psql -h localhost -U crypto_user -d crypto_main`

### Lỗi: Cannot connect to Redis

- Kiểm tra Redis đang chạy: `redis-cli ping`
- Kiểm tra port 6379 không bị block

### Lỗi: Shared library not found

```bash
# Build lại shared library
pnpm --filter @shared/core build
```

### Lỗi: Port already in use

- Thay đổi PORT trong `.env` hoặc kill process đang dùng port đó
- MacOS: `lsof -ti:3000 | xargs kill`

## Hot Reload

Tất cả services đều có hot reload với `start:dev`. Khi bạn sửa code, NestJS sẽ tự động restart.

## Debugging

### VSCode Debug Configuration

Tạo file `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Web Server",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@crypto/web-server", "start:dev"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Scripts Hữu Ích

Thêm vào `package.json` root:

```json
{
  "scripts": {
    "dev:all": "concurrently \"pnpm --filter @crypto/crawler-service start:dev\" \"pnpm --filter @crypto/price-collector-service start:dev\" \"pnpm --filter @crypto/web-server start:dev\" \"pnpm --filter @crypto/ai-service start:dev\"",
    "dev:shared": "pnpm --filter @shared/core start:dev",
    "dev:web": "pnpm --filter @crypto/web-server start:dev",
    "dev:crawler": "pnpm --filter @crypto/crawler-service start:dev",
    "dev:price": "pnpm --filter @crypto/price-collector-service start:dev",
    "dev:ai": "pnpm --filter @crypto/ai-service start:dev"
  }
}
```

Sau đó chạy:
```bash
pnpm dev:all  # Chạy tất cả
pnpm dev:web  # Chỉ chạy web server
```

