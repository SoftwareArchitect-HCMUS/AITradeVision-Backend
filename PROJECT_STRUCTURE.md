# Cấu Trúc Thư Mục Dự Án

```
FinalProject/
├── apps/                          # Các NestJS services
│   ├── crawler/                   # Crawler Service
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── crawler/          # Crawler module
│   │   │   │   ├── crawler.module.ts
│   │   │   │   ├── crawler.service.ts
│   │   │   │   ├── crawler.processor.ts
│   │   │   │   ├── extraction/   # Extraction service
│   │   │   │   └── strategies/   # Website-specific strategies
│   │   │   │       ├── bloomberg.strategy.ts
│   │   │   │       ├── reuters.strategy.ts
│   │   │   │       ├── cointelegraph.strategy.ts
│   │   │   │       ├── yahoo-finance.strategy.ts
│   │   │   │       ├── investing.strategy.ts
│   │   │   │       ├── cnbc-crypto.strategy.ts
│   │   │   │       └── generic.strategy.ts
│   │   │   ├── database/         # Database entities
│   │   │   │   └── entities/
│   │   │   │       └── news.entity.ts
│   │   │   ├── minio/            # MinIO service
│   │   │   │   ├── minio.module.ts
│   │   │   │   └── minio.service.ts
│   │   │   └── redis/            # Redis Pub/Sub
│   │   │       ├── redis.module.ts
│   │   │       └── redis.service.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── Dockerfile
│   │
│   ├── price-collector/          # Price Collector Service
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── binance/          # Binance WebSocket
│   │   │   │   ├── binance.module.ts
│   │   │   │   └── binance.service.ts
│   │   │   ├── database/         # TimescaleDB service
│   │   │   │   └── database.service.ts
│   │   │   └── redis/           # Redis Pub/Sub
│   │   │       ├── redis.module.ts
│   │   │       └── redis.service.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── Dockerfile
│   │
│   ├── web-server/              # Web Server API
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/            # Authentication
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.entity.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   └── local.strategy.ts
│   │   │   │   └── guards/
│   │   │   │       └── jwt-auth.guard.ts
│   │   │   ├── market/          # Market data
│   │   │   │   ├── market.module.ts
│   │   │   │   ├── market.controller.ts
│   │   │   │   └── market.service.ts
│   │   │   ├── news/            # News endpoints
│   │   │   │   ├── news.module.ts
│   │   │   │   ├── news.controller.ts
│   │   │   │   ├── news.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── news.entity.ts
│   │   │   └── price-gateway/   # WebSocket gateway
│   │   │       ├── price-gateway.module.ts
│   │   │       ├── price.gateway.ts
│   │   │       └── redis.service.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── nest-cli.json
│   │   └── Dockerfile
│   │
│   └── ai-service/              # AI Service
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── ai/              # AI endpoints
│       │   │   ├── ai.controller.ts
│       │   │   └── ai.service.ts
│       │   ├── news-processor/ # News event processor
│       │   │   ├── news-processor.module.ts
│       │   │   └── news-processor.service.ts
│       │   ├── gemini/         # Gemini API integration
│       │   │   ├── gemini.module.ts
│       │   │   └── gemini.service.ts
│       │   ├── qdrant/         # Qdrant vector DB
│       │   │   ├── qdrant.module.ts
│       │   │   └── qdrant.service.ts
│       │   ├── database/      # Database entities
│       │   │   ├── entities/
│       │   │   │   ├── news.entity.ts
│       │   │   │   └── ai-insight.entity.ts
│       │   │   └── database.service.ts
│       │   └── redis/         # Redis subscriber
│       │       ├── redis.module.ts
│       │       └── redis.service.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── nest-cli.json
│       └── Dockerfile
│
├── libs/                        # Shared libraries
│   └── shared/                  # Shared DTOs, types, events
│       ├── src/
│       │   ├── dto/            # Data Transfer Objects
│       │   │   ├── base.dto.ts
│       │   │   ├── auth.dto.ts
│       │   │   ├── market.dto.ts
│       │   │   ├── news.dto.ts
│       │   │   └── ai.dto.ts
│       │   ├── events/        # Event definitions
│       │   │   └── news.events.ts
│       │   ├── types/         # Common types
│       │   │   └── common.types.ts
│       │   └── index.ts       # Public exports
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/                     # Database scripts
│   ├── init-main-db.sql       # PostgreSQL initialization
│   ├── init-timescale-db.sql  # TimescaleDB initialization
│   └── seed-symbols.sql      # Seed trading symbols
│
├── docker-compose.yml          # Docker orchestration
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace config
├── tsconfig.json               # Root TypeScript config
├── .env                        # Environment variables (not in git)
├── .gitignore
├── .dockerignore
├── README.md                   # Main documentation
├── QUICKSTART.md               # Quick start guide
└── DEVELOPMENT.md              # Development guide
```

## Mô Tả Các Thư Mục

### `/apps` - NestJS Services

**crawler/** - Service crawl tin tức tài chính
- Crawl từ 6 nguồn: Bloomberg, Reuters, Cointelegraph, Yahoo Finance, Investing.com, CNBC Crypto
- Multi-strategy HTML extraction
- Lưu raw HTML vào MinIO
- Lưu cleaned news vào PostgreSQL
- Publish `news_created` event

**price-collector/** - Service thu thập giá real-time
- Kết nối Binance WebSocket (futures + spot)
- Thu thập tick data và aggregate OHLCV
- Lưu vào TimescaleDB
- Publish price updates qua Redis Pub/Sub

**web-server/** - REST API + WebSocket Gateway
- Authentication (JWT)
- Market data endpoints
- News endpoints
- WebSocket cho real-time prices
- Port: 3000

**ai-service/** - AI Analysis Service
- Lắng nghe `news_created` events
- Phân tích với Gemini API
- Lưu embeddings vào Qdrant
- Lưu insights vào PostgreSQL
- Port: 3001

### `/libs/shared` - Shared Library

Chứa DTOs, types, và events dùng chung cho tất cả services:
- `dto/` - Data Transfer Objects
- `events/` - Event definitions (Redis Pub/Sub)
- `types/` - Common TypeScript types

### `/scripts` - Database Scripts

SQL scripts để khởi tạo databases:
- `init-main-db.sql` - PostgreSQL schema
- `init-timescale-db.sql` - TimescaleDB schema + hypertables
- `seed-symbols.sql` - Seed trading symbols

## Ports

- **Web Server**: 3000
- **AI Service**: 3001
- **Crawler**: 3002
- **Price Collector**: 3003
- **Redis**: 6379
- **PostgreSQL**: 5432
- **TimescaleDB**: 5433
- **Qdrant**: 6333, 6334
- **MinIO**: 9000, 9001

## Build Output

Khi build, các services sẽ tạo `dist/` folder trong mỗi app:
- `apps/web-server/dist/` - Compiled JavaScript
- `apps/crawler/dist/` - Compiled JavaScript
- `apps/price-collector/dist/` - Compiled JavaScript
- `apps/ai-service/dist/` - Compiled JavaScript
- `libs/shared/dist/` - Compiled shared library

