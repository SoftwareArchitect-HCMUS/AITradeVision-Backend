# Quick Start Guide

## Prerequisites

1. **Docker & Docker Compose** - Install from https://docs.docker.com/get-docker/
2. **pnpm** - Install with `npm install -g pnpm` and `pnpm install`
3. **Gemini API Key** - Get from https://makersuite.google.com/app/apikey

## Step-by-Step Setup

### 1. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set your Gemini API key
# GEMINI_API_KEY=your-api-key-here
```

### 2. Start All Services

```bash
# Start all services in detached mode
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

### 3. Verify Services

- **Web Server**: http://localhost:3000
- **AI Service**: http://localhost:3001
- **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)
- **Qdrant Dashboard**: http://localhost:6333/dashboard

### 4. Test API

```bash
# Register a user
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

# Get latest news (requires JWT token from login)
curl -X GET http://localhost:3000/news/latest \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get market history
curl -X GET "http://localhost:3000/market/history?symbol=BTCUSDT&interval=1m" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. WebSocket Test

```javascript
// Using Socket.IO client
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to WebSocket');
  
  // Subscribe to BTCUSDT price updates
  socket.emit('subscribe_price', { symbol: 'BTCUSDT' });
});

socket.on('price_update', (data) => {
  console.log('Price update:', data);
});
```

## Service Health Checks

```bash
# Check Redis
docker compose exec redis redis-cli ping

# Check PostgreSQL
docker compose exec postgres_main pg_isready -U crypto_user

# Check TimescaleDB
docker compose exec timescaledb pg_isready -U timescale_user

# Check Qdrant
curl http://localhost:6333/health

# Check MinIO
curl http://localhost:9000/minio/health/live
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker compose logs <service-name>

# Restart a service
docker compose restart <service-name>

# Rebuild and restart
docker compose up -d --build <service-name>
```

### Database connection errors

```bash
# Wait for databases to be ready
docker compose up -d postgres_main timescaledb
sleep 10

# Then start other services
docker compose up -d
```

### Clear all data and restart

```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes all data)
docker compose down -v

# Start fresh
docker compose up -d
```

## Development Mode

To run services locally (without Docker):

```bash
# 1. Start only infrastructure
docker compose up -d redis postgres_main timescaledb qdrant minio

# 2. Install dependencies
pnpm install

# 3. Build shared library
pnpm --filter @shared/core build

# 4. Run services in separate terminals
pnpm --filter @crypto/crawler-service start:dev
pnpm --filter @crypto/price-collector-service start:dev
pnpm --filter @crypto/web-server start:dev
pnpm --filter @crypto/ai-service start:dev
```

## Next Steps

1. Monitor crawler service - it will start crawling news automatically
2. Check price collector - it connects to Binance and starts collecting data
3. Wait for news to be crawled and analyzed by AI service
4. Query AI insights: `GET /ai/insights?symbol=BTCUSDT`

