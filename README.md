# Crypto Analytics Platform

A scalable multi-service backend system for a TradingView-like crypto analytics platform with financial news crawling and AI analysis using Gemini API.

## Overview

This platform provides real-time cryptocurrency market data, financial news aggregation, and AI-powered analysis. It consists of 4 microservices working together to deliver:

- **Real-time price data** from Binance WebSocket
- **Automated news crawling** from major financial sources (Bloomberg, Reuters, Cointelegraph, etc.)
- **AI-powered analysis** using Google Gemini API
- **REST API & WebSocket** for client applications
- **Vector search** for semantic news/article search

## Features

- 🔄 **Real-time Price Updates**: WebSocket streaming from Binance (Futures & Spot)
- 📰 **News Aggregation**: Automated crawling from 6+ sources every 5 minutes
- 🤖 **AI Analysis**: Sentiment analysis, summaries, and insights using Gemini
- 🔍 **Semantic Search**: Vector-based search using Qdrant for similar articles
- 📊 **Time-Series Data**: Optimized storage with TimescaleDB for OHLCV and ticks
- 🔐 **JWT Authentication**: Secure API access with user management
- 🐳 **Docker Ready**: Full Docker Compose setup for easy deployment
- 📦 **Monorepo**: pnpm workspaces for shared code and dependencies
- 🔄 **Event-Driven**: Redis Pub/Sub for service communication
- 📦 **Object Storage**: MinIO for raw HTML storage and audit

## Architecture

### System Architecture Diagram

![System Architecture](docs/architect.png)

*Architecture diagram showing the interaction between services, databases, and external systems*

> **Note**: Place your architecture diagram image in the `docs/` directory and name it `architecture.png` (or update the path above to match your image file).

### Microservices Overview

The system consists of 4 main microservices:

1. **Crawler Service** - Crawls financial news from multiple sources
2. **Price Collector Service** - Collects real-time price data from Binance
3. **Web Server API** - REST API and WebSocket gateway for clients
4. **AI Service** - Analyzes news using Gemini API and stores insights

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Message Queue**: BullMQ with Redis
- **Pub/Sub**: Redis Pub/Sub
- **Databases**: 
  - PostgreSQL (main database for users, news, AI insights)
  - TimescaleDB (time-series data for OHLCV and ticks)
  - Qdrant (vector database for embeddings)
- **Object Storage**: MinIO (for raw HTML storage)
- **AI**: Google Gemini API
- **Package Manager**: pnpm (monorepo with workspaces)

## Prerequisites

- **Docker and Docker Compose** - For running infrastructure services
- **pnpm** (>= 8.0.0) - Package manager
  ```bash
  npm install -g pnpm
  # Or if using nvm, ensure pnpm is in PATH:
  export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
  ```
- **Node.js** (>= 18.0.0) - Runtime environment
- **Gemini API key** - Get from https://makersuite.google.com/app/apikey (for AI features)

## Quick Start

1. **Clone the repository**

```bash
git clone https://github.com/SoftwareArchitect-HCMUS/AITradeVision-Backend.git
cd FinalProject
```

2. **Set up environment variables**

Create `.env` file in the root directory:

```bash
# Create .env file
cat > .env << 'EOF'
# PostgreSQL Main Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=crypto_user
POSTGRES_PASSWORD=crypto_pass
POSTGRES_DB=crypto_main

# TimescaleDB
TIMESCALE_HOST=localhost
TIMESCALE_PORT=5433
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
MINIO_BUCKET=raw-html

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Gemini API (REQUIRED for AI features)
GEMINI_API_KEY=your-gemini-api-key-here

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
EOF
```

**Important**: Replace `GEMINI_API_KEY` with your actual API key from https://makersuite.google.com/app/apikey

3. **Start all services with Docker Compose**

```bash
docker compose up -d
```

This will start:
- Redis (port 6379)
- PostgreSQL (port 5432)
- TimescaleDB (port 5433)
- Qdrant (ports 6333, 6334)
- MinIO (ports 9000, 9001)
- All 4 NestJS services

4. **Access services**

- Web Server API: http://localhost:3000
- **Swagger API Documentation**: http://localhost:3000/api
- AI Service: http://localhost:3001
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- Qdrant Dashboard: http://localhost:6333/dashboard

## API Documentation

**Swagger UI**: Access the interactive API documentation at http://localhost:3000/api

The Swagger documentation provides:
- Complete API endpoint descriptions
- Request/response schemas
- Try-it-out functionality
- JWT authentication support

## API Endpoints

### Authentication (Web Server - Port 3000)

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user

### Market Data (Web Server - Port 3000)

- `GET /market/history?symbol=BTCUSDT&interval=1m` - Get historical OHLCV data
- `GET /market/realtime?symbol=BTCUSDT` - Get latest price

### News (Web Server - Port 3000)

- `GET /news/latest?limit=20&page=1` - Get latest news articles

### AI Insights (AI Service - Port 3001)

- `GET /ai/insights?symbol=BTCUSDT` - Get AI insights for a symbol
- `GET /ai/search?query=bitcoin price prediction&limit=10` - Search similar news/articles

## WebSocket

Connect to `ws://localhost:3000` for real-time price updates:

```javascript
const socket = io('http://localhost:3000');

// Subscribe to price updates
socket.emit('subscribe_price', { symbol: 'BTCUSDT' });

// Receive price updates
socket.on('price_update', (data) => {
  console.log('Price update:', data);
});

// Unsubscribe
socket.emit('unsubscribe_price', { symbol: 'BTCUSDT' });
```

## Service Details

### Crawler Service (Port 3002)

**Responsibilities:**
- Crawls news from: Bloomberg, Reuters, Cointelegraph, Yahoo Finance, Investing.com, CNBC Crypto
- Uses multi-strategy extraction (CSS selectors, XPath, generic readability algorithm)
- Stores raw HTML in MinIO for audit purposes
- Stores cleaned news in PostgreSQL
- Publishes `news_created` events to Redis Pub/Sub channel

**How it works:**
1. Scheduled crawl every 5 minutes
2. Fetches article links from news source pages
3. Extracts content using source-specific strategies
4. Uploads raw HTML to MinIO
5. Extracts cryptocurrency tickers from content
6. Saves to PostgreSQL
7. Publishes event to Redis for AI service

### Price Collector Service (Port 3003)

**Responsibilities:**
- Connects to Binance WebSocket (futures and spot markets)
- Collects real-time tick data
- Aggregates OHLCV data (1s, 1m intervals)
- Stores data in TimescaleDB (time-series optimized)
- Publishes price updates to Redis Pub/Sub

**How it works:**
1. Fetches active symbols from TimescaleDB
2. Connects to Binance Futures and Spot WebSocket streams
3. Receives tick data in real-time
4. Aggregates into OHLCV candles
5. Stores in TimescaleDB hypertables
6. Publishes price updates to Redis for web server

### Web Server API (Port 3000)

**Responsibilities:**
- REST API with JWT authentication
- WebSocket gateway for real-time price updates
- Serves market data from TimescaleDB
- Serves news from PostgreSQL
- Subscribes to Redis price updates and broadcasts to WebSocket clients

**Endpoints:**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login (returns JWT)
- `GET /market/history` - Historical OHLCV data
- `GET /market/realtime` - Latest price
- `GET /news/latest` - Latest news articles
- WebSocket: `subscribe_price`, `unsubscribe_price`

### AI Service (Port 3001)

**Responsibilities:**
- Listens to `news_created` events from Redis
- Fetches historical price data from TimescaleDB
- Analyzes news with Gemini API (sentiment, summary, reasoning)
- Generates embeddings using Gemini embedding model
- Stores embeddings in Qdrant vector database
- Stores AI insights in PostgreSQL

**How it works:**
1. Subscribes to `news_created` Redis channel
2. When news is created, fetches related price data
3. Sends news + price context to Gemini API
4. Receives analysis (sentiment, summary, impact prediction)
5. Generates embedding vector
6. Stores in Qdrant for semantic search
7. Saves insights to PostgreSQL

## Database Schemas

### PostgreSQL (Main Database)

- `users` - User accounts
- `news` - Crawled news articles
- `ai_insights` - AI analysis results

### TimescaleDB

- `symbols` - Trading symbols
- `ticks` - Tick data (hypertable)
- `ohlcv` - OHLCV data (hypertable)

## Development

### Local Development (without Docker)

#### 1. Install Dependencies

```bash
# Ensure pnpm is in PATH (if using nvm)
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"

# Install all dependencies
pnpm install
```

#### 2. Start Infrastructure Services

Chỉ chạy infrastructure bằng Docker, còn NestJS services chạy local:

```bash
# Start infrastructure services
docker compose up -d redis postgres_main timescaledb qdrant minio

# Verify services are running
docker compose ps
```

#### 3. Build Shared Library

```bash
# Build shared library first (required by all services)
pnpm --filter @shared/core build
```

#### 4. Run Services in Development Mode

**Option A: Using workspace scripts (Recommended)**

```bash
# From project root
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"

# Run individual services
pnpm dev:web        # Web Server (port 3000)
pnpm dev:crawler    # Crawler Service (port 3002)
pnpm dev:price      # Price Collector (port 3003)
pnpm dev:ai         # AI Service (port 3001)
```

**Option B: Run in separate terminals**

Mở 4 terminal windows và chạy:

```bash
# Terminal 1 - Crawler Service
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
pnpm --filter @crypto/crawler-service start:dev

# Terminal 2 - Price Collector Service
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
pnpm --filter @crypto/price-collector-service start:dev

# Terminal 3 - Web Server
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
pnpm --filter @crypto/web-server start:dev

# Terminal 4 - AI Service
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
pnpm --filter @crypto/ai-service start:dev
```

**Note**: Nếu gặp lỗi "command not found: pnpm", thêm vào `~/.zshrc` hoặc `~/.bashrc`:
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
```

### Building for Production

```bash
# Build all services
pnpm build

# Or build individually
pnpm --filter @crypto/crawler-service build
pnpm --filter @crypto/price-collector-service build
pnpm --filter @crypto/web-server build
pnpm --filter @crypto/ai-service build
```

## Seed Data

Default symbols are automatically seeded in TimescaleDB:
- BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, ADAUSDT, XRPUSDT, DOGEUSDT, DOTUSDT, MATICUSDT, AVAXUSDT

To add more symbols, run:

```bash
docker compose exec timescaledb psql -U timescale_user -d timescale_db -f /docker-entrypoint-initdb.d/seed-symbols.sql
```

## Monitoring

- Check service logs: `docker compose logs -f <service-name>`
- View all logs: `docker compose logs -f`
- Check service health: `docker compose ps`

## Troubleshooting

### Common Issues

1. **Services not starting**
   - Check Docker logs: `docker compose logs <service-name>`
   - Ensure all environment variables are set in `.env`
   - Verify infrastructure services are running: `docker compose ps`

2. **Database connection errors**
   - Ensure databases are healthy: `docker compose ps`
   - Check TimescaleDB port is 5433 (not 5432)
   - Verify credentials in `.env` match docker-compose.yml
   - Test connection: `psql -h localhost -p 5433 -U timescale_user -d timescale_db`

3. **Redis connection errors**
   - Check Redis is running: `docker compose ps redis`
   - Test connection: `docker compose exec redis redis-cli ping`
   - Verify `REDIS_HOST` and `REDIS_PORT` in `.env`

4. **Gemini API errors**
   - Verify `GEMINI_API_KEY` is set correctly in `.env`
   - Check API key is valid at https://makersuite.google.com/app/apikey
   - AI service will show warning if key is missing but will still start

5. **pnpm command not found**
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
   source ~/.zshrc  # or source ~/.bashrc
   ```

6. **Build errors (bcrypt native module)**
   ```bash
   # Rebuild bcrypt
   cd node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt
   npm run install
   ```

7. **Module not found errors**
   - Ensure shared library is built: `pnpm --filter @shared/core build`
   - Rebuild the service: `pnpm --filter @crypto/<service> build`

8. **Port already in use**
   ```bash
   # Find and kill process using port
   lsof -ti:3000 | xargs kill  # For port 3000
   # Or change PORT in .env
   ```

## Project Structure

```
.
├── apps/                      # Microservices
│   ├── crawler/              # Crawler service (port 3002)
│   │   ├── src/
│   │   │   ├── crawler/      # Crawler logic & extraction strategies
│   │   │   ├── database/    # Database entities
│   │   │   ├── minio/       # MinIO integration
│   │   │   └── redis/       # Redis Pub/Sub
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── price-collector/      # Price collector service (port 3003)
│   │   ├── src/
│   │   │   ├── binance/     # Binance WebSocket client
│   │   │   ├── database/    # TimescaleDB operations
│   │   │   └── redis/       # Redis Pub/Sub
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── web-server/           # Web API server (port 3000)
│   │   ├── src/
│   │   │   ├── auth/        # Authentication & JWT
│   │   │   ├── market/      # Market data endpoints
│   │   │   ├── news/        # News endpoints
│   │   │   └── price-gateway/ # WebSocket gateway
│   │   ├── Dockerfile
│   │   └── package.json
│   └── ai-service/          # AI analysis service (port 3001)
│       ├── src/
│       │   ├── ai/          # AI endpoints
│       │   ├── gemini/      # Gemini API integration
│       │   ├── qdrant/     # Vector database
│       │   ├── news-processor/ # News event processor
│       │   └── redis/       # Redis Pub/Sub
│       ├── Dockerfile
│       └── package.json
├── libs/
│   └── shared/              # Shared library
│       └── src/
│           ├── dto/        # Data Transfer Objects
│           ├── events/     # Redis event definitions
│           └── types/      # Common TypeScript types
├── scripts/                  # Database initialization scripts
│   ├── init-main-db.sql    # PostgreSQL schema
│   ├── init-timescale-db.sql # TimescaleDB schema
│   └── seed-symbols.sql    # Initial trading symbols
├── docker-compose.yml        # Docker orchestration
├── .env                      # Environment variables (not in git)
├── .gitignore
├── pnpm-workspace.yaml       # pnpm workspace config
├── tsconfig.json            # Root TypeScript config
├── README.md                 # This file
├── DEVELOPMENT.md           # Detailed development guide
└── QUICKSTART.md            # Quick start guide
```

## Testing the System

### 1. Verify All Services are Running

```bash
# Check Docker services
docker compose ps

# Check if services are listening
curl http://localhost:3000/health  # Web Server
curl http://localhost:3001/health  # AI Service (if health endpoint exists)
```

### 2. Test News Crawling

```bash
# Check crawler logs
docker compose logs -f crawler-service

# Or if running locally
# Watch for "Processed article" messages
```

### 3. Test Price Collection

```bash
# Check price collector logs
docker compose logs -f price-collector-service

# Should see "Binance Futures WebSocket connected" and price updates
```

### 4. Test WebSocket

```javascript
// Using Node.js
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected');
  socket.emit('subscribe_price', { symbol: 'BTCUSDT' });
});

socket.on('price_update', (data) => {
  console.log('📈 Price:', data);
});
```

### 5. Test AI Analysis

```bash
# Wait for news to be crawled and analyzed (may take a few minutes)
# Then query AI insights
curl "http://localhost:3001/ai/insights?symbol=BTCUSDT"
```

## Data Flow Example

1. **Crawler** crawls a news article about Bitcoin
2. **Crawler** publishes `news_created` event to Redis
3. **AI Service** receives event, analyzes news with Gemini
4. **AI Service** stores insights in PostgreSQL and embeddings in Qdrant
5. **Price Collector** receives price update from Binance
6. **Price Collector** stores in TimescaleDB and publishes to Redis
7. **Web Server** receives price update, broadcasts to WebSocket clients
8. **Web Server** serves news and insights via REST API

## Additional Resources

- **DEVELOPMENT.md** - Detailed guide for local development
- **QUICKSTART.md** - Quick start guide with Docker
- **PROJECT_STRUCTURE.md** - Detailed project structure documentation

## License

MIT

