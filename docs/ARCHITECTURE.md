# Kiến Trúc Hệ Thống AITradeVision Backend

## Tổng Quan

AITradeVision Backend là một nền tảng phân tích cryptocurrency theo thời gian thực với kiến trúc microservices, được xây dựng bằng NestJS và TypeScript. Hệ thống cung cấp dữ liệu giá real-time, thu thập tin tức tài chính tự động, và phân tích AI sử dụng Groq API.

## Kiến Trúc Tổng Thể

### Sơ Đồ Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT APPLICATIONS                                 │
│                        (Web App / Mobile App / Desktop)                          │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            REST API│              WebSocket (WS)
                    │                     │
┌───────────────────▼─────────────────────▼──────────────────────────────────────┐
│                           WEB SERVER (Port 3000)                                │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │     Auth     │    Market    │     News     │      AI      │ Price Gateway│ │
│  │  Controller  │  Controller  │  Controller  │  Controller  │   (WebSocket)│ │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘ │
│         │              │              │              │              │         │
└─────────┼──────────────┼──────────────┼──────────────┼──────────────┼─────────┘
          │              │              │              │              │
          │              │              │              │              │
┌─────────▼──────────────▼──────────────▼──────────────▼──────────────▼─────────┐
│                         Redis Pub/Sub & BullMQ Queue                           │
│                              (Port 6379)                                       │
│  ┌──────────────────┬──────────────────┬──────────────────┬─────────────────┐ │
│  │  price:update    │  news:created    │  crawl-news      │   Cache Layer   │ │
│  │    Channel       │    Channel       │     Queue        │                 │ │
│  └──────────────────┴──────────────────┴──────────────────┴─────────────────┘ │
└──────────┬─────────────────┬─────────────────┬──────────────────┬─────────────┘
           │                 │                 │                  │
┌──────────▼─────┐  ┌────────▼────────┐  ┌─────▼──────────┐  ┌──▼──────────────┐
│  PRICE         │  │   CRAWLER       │  │  AI SERVICE    │  │  External APIs  │
│  COLLECTOR     │  │   SERVICE       │  │  (Port 3001)   │  │                 │
│  (Port 3003)   │  │  (Port 3002)    │  │                │  │  - Groq API     │
│                │  │                 │  │                │  │  - Binance WS   │
│  ┌──────────┐  │  │  ┌───────────┐  │  │  ┌──────────┐  │  └─────────────────┘
│  │ Binance  │  │  │  │  BullMQ   │  │  │  │  Groq    │  │
│  │ WebSocket│  │  │  │ Processor │  │  │  │  Service │  │
│  │ Service  │  │  │  └───────────┘  │  │  └──────────┘  │
│  └────┬─────┘  │  │  ┌───────────┐  │  │  ┌──────────┐  │
│       │        │  │  │Extraction │  │  │  │   News   │  │
│       │        │  │  │  Service  │  │  │  │Processor │  │
│  ┌────▼─────┐  │  │  └───────────┘  │  │  │ Service  │  │
│  │ Database │  │  │  ┌───────────┐  │  │  └──────────┘  │
│  │ Service  │  │  │  │  Groq     │  │  │  ┌──────────┐  │
│  └──────────┘  │  │  │  Service  │  │  │  │ Database │  │
└────────┬───────┘  │  └───────────┘  │  │  │ Service  │  │
         │          └────────┬────────┘  │  └──────────┘  │
         │                   │           └────────┬────────┘
         │                   │                    │
┌────────▼───────────────────▼────────────────────▼───────────────────────────────┐
│                              DATABASES                                           │
│  ┌──────────────────────────┐        ┌──────────────────────────────────────┐  │
│  │   PostgreSQL Main        │        │       TimescaleDB                    │  │
│  │     (Port 5432)          │        │       (Port 5433)                    │  │
│  │                          │        │                                      │  │
│  │  - users                 │        │  - ohlcv_data (Hypertable)          │  │
│  │  - news                  │        │  - tick_data (Hypertable)           │  │
│  │  - ai_insights           │        │  - symbols                          │  │
│  │  - symbols               │        │                                      │  │
│  └──────────────────────────┘        └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Chi Tiết Các Microservice

### 1. Web Server (Port 3000)

**Vai trò**: API Gateway và WebSocket Gateway chính cho client applications

**Chức năng**:
- Cung cấp REST API cho authentication, market data, news, và AI insights
- WebSocket gateway để streaming giá real-time cho clients
- JWT authentication và authorization
- Swagger API documentation

**Modules chính**:

#### 1.1 Auth Module
- **AuthController**: Đăng ký, đăng nhập, nâng cấp VIP, quản lý profile
- **AuthService**: Xử lý business logic authentication
- **JwtStrategy**: JWT token validation
- **Entities**: User

#### 1.2 Market Module
- **MarketController**: APIs cho market data, OHLCV, symbols
- **MarketService**: Truy vấn dữ liệu từ TimescaleDB
- **BinanceService**: Gọi Binance REST API
- **RedisCacheService**: Cache dữ liệu market để tăng performance

#### 1.3 News Module
- **NewsController**: APIs query tin tức theo filter, phân trang
- **NewsService**: Truy vấn news từ PostgreSQL

#### 1.4 AI Module
- **AIController**: APIs lấy AI insights, sentiment analysis
- **AIService**: Query AI insights từ database
- **AICacheService**: Cache AI analysis results

#### 1.5 Price Gateway Module
- **PriceGateway**: WebSocket server nhận connections từ clients
- **RedisService**: Subscribe Redis `price:update` channel và broadcast đến clients

**Database Connections**:
- PostgreSQL Main (users, news)
- TimescaleDB (OHLCV, ticks)
- Redis (pub/sub, caching)

---

### 2. Crawler Service (Port 3002)

**Vai trò**: Thu thập tin tức tự động từ các nguồn tài chính

**Chức năng**:
- Crawl tin tức mỗi 5 phút từ Bloomberg, Reuters, Cointelegraph, CNBC
- Trích xuất nội dung article (title, content, tickers)
- Phát sự kiện `news:created` qua Redis Pub/Sub
- Sử dụng BullMQ để quản lý crawl jobs

**Components chính**:

#### 2.1 Crawler Module
- **CrawlerService**: Lên lịch và quản lý crawl tasks
- **CrawlerProcessor**: BullMQ worker xử lý crawl jobs
- **ExtractionService**: Trích xuất content từ HTML
- **Strategies**: Các strategy pattern cho từng news source
  - Bloomberg Strategy
  - Reuters Strategy
  - Cointelegraph Strategy
  - CNBC Strategy

#### 2.2 GroqService
- Phân tích tin tức để extract tickers (BTC, ETH, SOL...)
- Sentiment analysis preview

**Flow**:
```
1. CrawlerService schedule crawl jobs → BullMQ queue
2. CrawlerProcessor pick job → Gọi ExtractionService
3. ExtractionService → Strategy pattern extract content
4. GroqService analyze → Extract tickers
5. Save to PostgreSQL → Publish news:created event
```

---

### 3. Price Collector Service (Port 3003)

**Vai trò**: Thu thập dữ liệu giá real-time từ Binance

**Chức năng**:
- Kết nối Binance Futures WebSocket (kline streams)
- Kết nối Binance Spot WebSocket
- Lưu OHLCV data vào TimescaleDB hypertables
- Publish `price:update` events qua Redis Pub/Sub

**Components chính**:

#### 3.1 Binance Module
- **BinanceService**: Quản lý WebSocket connections
  - Multiple symbols: BTC, ETH, SOL, BNB...
  - Multiple timeframes: 1m, 5m, 1h, 1d
  - Auto-reconnect logic
  - Kline data processing

#### 3.2 Database Module
- **DatabaseService**: Write operations tối ưu cho TimescaleDB
  - Bulk insert OHLCV data
  - Manage hypertables
  - Query active symbols

#### 3.3 Redis Module
- **RedisService**: Publish price updates
  - Channel: `price:update`
  - Format: PriceUpdate event

**Data Flow**:
```
Binance WebSocket → BinanceService process kline
                 ↓
           Save to TimescaleDB (hypertable)
                 ↓
        Publish to Redis price:update channel
                 ↓
           Web Server PriceGateway subscribes
                 ↓
         Broadcast to connected clients via WS
```

---

### 4. AI Service (Port 3001)

**Vai trò**: Phân tích tin tức bằng AI và tạo insights

**Chức năng**:
- Subscribe `news:created` events từ Redis
- Lấy historical price data từ TimescaleDB
- Gọi Groq API để phân tích tin tức
- Lưu AI insights vào PostgreSQL

**Components chính**:

#### 4.1 News Processor Module
- **NewsProcessorService**: 
  - Subscribe Redis news:created channel
  - Process mỗi ticker trong news
  - Orchestrate AI analysis pipeline

#### 4.2 Groq Module
- **GroqService**: 
  - Call Groq API (LLM: mixtral-8x7b-32768)
  - Prompt engineering for analysis
  - Parse JSON response
  - Return: sentiment, summary, reasoning, prediction, confidence

#### 4.3 Database Module
- **DatabaseService**:
  - Query news by ID
  - Get historical prices (24h)
  - Save AI insights

**Analysis Pipeline**:
```
1. Receive news:created event
2. Get full news article from DB
3. For each ticker mentioned:
   a. Get 24h historical price
   b. Call Groq API with (news + price data)
   c. Groq returns sentiment + prediction
   d. Save AI insight to database
```

---

## Shared Libraries

### libs/shared
Chứa code dùng chung giữa các services (monorepo pattern)

**Structure**:
```
libs/shared/
├── dto/           # Data Transfer Objects
│   ├── auth.dto.ts       # RegisterDto, LoginDto, AuthResponseDto
│   ├── market.dto.ts     # OHLCVDto, TickDto, SymbolDto
│   ├── news.dto.ts       # NewsDto, NewsQueryDto
│   └── ai.dto.ts         # AIInsightDto, AnalysisDto
├── events/        # Event definitions
│   └── news.events.ts    # NewsCreatedEvent
└── types/         # TypeScript types
    └── common.types.ts   # PriceUpdate, TickData, OHLCVData
```

---

## Database Schema

### PostgreSQL Main (Port 5432)

#### Table: users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_vip BOOLEAN DEFAULT false,
  vip_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Table: news
```sql
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  full_text TEXT,
  url TEXT UNIQUE NOT NULL,
  source VARCHAR(100),
  published_at TIMESTAMP,
  tickers TEXT[],  -- Array of ticker symbols
  sentiment VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_published_at ON news(published_at DESC);
CREATE INDEX idx_news_tickers ON news USING GIN(tickers);
CREATE INDEX idx_news_source ON news(source);
```

#### Table: ai_insights
```sql
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  sentiment VARCHAR(20),  -- bullish, bearish, neutral
  summary TEXT,
  reasoning TEXT,
  prediction VARCHAR(50), -- up, down, stable
  confidence FLOAT,       -- 0.0 to 1.0
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_news_id ON ai_insights(news_id);
CREATE INDEX idx_ai_insights_symbol ON ai_insights(symbol);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at DESC);
```

#### Table: symbols
```sql
CREATE TABLE symbols (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  market_cap BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### TimescaleDB (Port 5433)

#### Hypertable: ohlcv_data
```sql
CREATE TABLE ohlcv_data (
  time TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,  -- 1m, 5m, 1h, 1d
  open NUMERIC(20, 8),
  high NUMERIC(20, 8),
  low NUMERIC(20, 8),
  close NUMERIC(20, 8),
  volume NUMERIC(20, 8),
  PRIMARY KEY (time, symbol, timeframe)
);

-- Convert to hypertable
SELECT create_hypertable('ohlcv_data', 'time');

-- Indexes
CREATE INDEX idx_ohlcv_symbol_time ON ohlcv_data(symbol, time DESC);
CREATE INDEX idx_ohlcv_timeframe ON ohlcv_data(timeframe);
```

#### Hypertable: tick_data
```sql
CREATE TABLE tick_data (
  time TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  quantity NUMERIC(20, 8),
  is_buyer_maker BOOLEAN,
  PRIMARY KEY (time, symbol)
);

-- Convert to hypertable
SELECT create_hypertable('tick_data', 'time');

-- Indexes
CREATE INDEX idx_tick_symbol_time ON tick_data(symbol, time DESC);
```

---

## Message Queue & Pub/Sub

### Redis (Port 6379)

#### Pub/Sub Channels

**1. price:update**
- Publisher: Price Collector Service
- Subscriber: Web Server (PriceGateway)
- Payload:
```typescript
interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: number;
}
```

**2. news:created**
- Publisher: Crawler Service
- Subscriber: AI Service
- Payload:
```typescript
interface NewsCreatedEvent {
  newsId: string;
  title: string;
  source: string;
  tickers: string[];
  publishedAt: Date;
}
```

#### BullMQ Queues

**Queue: crawl-news**
- Producer: CrawlerService
- Consumer: CrawlerProcessor
- Job data:
```typescript
interface CrawlJob {
  source: string;      // bloomberg, reuters, etc.
  url: string;
}
```

---

## API Endpoints

### Authentication APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Đăng ký user mới | No |
| POST | `/auth/login` | Đăng nhập | No |
| POST | `/auth/upgrade-vip` | Nâng cấp VIP | Yes (JWT) |
| PUT | `/auth/profile` | Cập nhật profile | Yes (JWT) |

### Market APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/market/symbols` | Lấy danh sách symbols | No |
| GET | `/market/ohlcv/:symbol` | OHLCV data theo symbol | No |
| GET | `/market/ticks/:symbol` | Tick data theo symbol | No |
| GET | `/market/summary` | Market summary | No |

### News APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/news` | Danh sách tin tức (filter, pagination) | No |
| GET | `/news/:id` | Chi tiết tin tức | No |

### AI APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/ai/insights/:symbol` | AI insights cho symbol | Yes (JWT) |
| GET | `/ai/insights/news/:newsId` | AI insights cho tin tức | Yes (JWT) |

### WebSocket API

**Endpoint**: `ws://localhost:3000/ws`

**Client Messages**:
```json
// Subscribe to price updates
{
  "type": "subscribe_price",
  "symbol": "BTCUSDT"
}

// Unsubscribe
{
  "type": "unsubscribe_price",
  "symbol": "BTCUSDT"
}
```

**Server Messages**:
```json
// Price update
{
  "type": "price_update",
  "symbol": "BTCUSDT",
  "data": {
    "symbol": "BTCUSDT",
    "price": 45000.50,
    "change24h": 2.5,
    "volume24h": 1234567890,
    "timestamp": 1234567890
  }
}
```

---

## Luồng Dữ Liệu Chính

### 1. Price Data Flow

```
Binance WebSocket (kline streams)
    ↓
Price Collector: BinanceService receives kline data
    ↓
Process & transform to OHLCV format
    ↓
Save to TimescaleDB (ohlcv_data hypertable)
    ↓
Publish to Redis (price:update channel)
    ↓
Web Server: PriceGateway subscribes
    ↓
Broadcast to all subscribed WebSocket clients
    ↓
Client receives real-time price updates
```

### 2. News Crawling & AI Analysis Flow

```
CrawlerService schedules crawl (every 5 min)
    ↓
BullMQ queue: crawl-news jobs
    ↓
CrawlerProcessor picks job
    ↓
ExtractionService + Strategy extracts content
    ↓
GroqService extracts tickers from content
    ↓
Save news to PostgreSQL
    ↓
Publish to Redis (news:created channel)
    ↓
AI Service: NewsProcessorService subscribes
    ↓
For each ticker:
  - Get 24h historical price from TimescaleDB
  - Call Groq API for analysis
  - Parse response (sentiment, prediction, etc.)
  - Save ai_insights to PostgreSQL
    ↓
Client queries AI insights via REST API
```

### 3. Client Request Flow (REST API)

```
Client sends HTTP request (e.g., GET /market/ohlcv/BTCUSDT)
    ↓
Web Server: MarketController receives
    ↓
Check RedisCacheService for cached data
    ↓
If cache miss:
  - MarketService queries TimescaleDB
  - Cache result in Redis
    ↓
Return response to client
```

---

## Các Pattern và Best Practices

### 1. Microservices Pattern
- Tách biệt concerns: web server, crawler, price collector, AI service
- Mỗi service có database connection riêng
- Communication qua Redis Pub/Sub (loose coupling)
- Independent deployment & scaling

### 2. Event-Driven Architecture
- Redis Pub/Sub cho async communication
- Events: `news:created`, `price:update`
- Decoupled services, easy to add new subscribers

### 3. Repository Pattern
- TypeORM repositories cho data access
- Abstraction layer giữa business logic và database
- Dễ testing và maintainability

### 4. Strategy Pattern
- Crawler strategies cho mỗi news source
- Bloomberg, Reuters, Cointelegraph có extraction logic khác nhau
- Easy to add new sources

### 5. Gateway Pattern
- Web Server như API Gateway
- WebSocket Gateway cho real-time data
- Single entry point cho clients

### 6. Caching Strategy
- Redis cache cho market data
- Cache AI insights để giảm load database
- TTL-based invalidation

### 7. Time-Series Optimization
- TimescaleDB hypertables cho OHLCV và tick data
- Automatic partitioning by time
- Optimized queries cho time-range data

### 8. Queue-Based Processing
- BullMQ cho crawl jobs
- Job retry mechanism
- Distributed processing capability

---

## Scalability & Performance

### Horizontal Scaling
- **Web Server**: Scale out multiple instances behind load balancer
- **Crawler Service**: Add more workers để crawl nhiều sources song song
- **Price Collector**: Partition symbols across multiple instances
- **AI Service**: Add more workers để process nhiều news đồng thời

### Database Optimization
- **TimescaleDB**: 
  - Hypertables auto-partition by time
  - Compression policies cho old data
  - Continuous aggregates cho pre-computed views
- **PostgreSQL**: 
  - Indexes trên frequently queried columns
  - Connection pooling
- **Redis**: 
  - Pub/Sub không lưu message history (memory efficient)
  - Cache eviction policies (LRU)

### Caching Strategy
- Market data cache: TTL 10 seconds
- AI insights cache: TTL 1 hour
- Symbol list cache: TTL 1 day

---

## Security

### Authentication & Authorization
- JWT tokens cho API authentication
- Bearer token trong HTTP headers
- Token expiration: 24h
- Password hashing: bcrypt

### API Security
- CORS enabled với whitelist origins
- Rate limiting (TODO: add rate limiter middleware)
- Input validation: ValidationPipe (class-validator)
- SQL injection prevention: TypeORM parameterized queries

### WebSocket Security
- Optional: JWT token trong WebSocket connection (TODO)
- Message validation
- Connection rate limiting

---

## Monitoring & Logging

### Logging
- NestJS Logger trên mỗi service
- Log levels: debug, log, warn, error
- Structured logging format

### Health Checks
- Database health checks trong docker-compose
- Redis ping health check
- Service startup logs

### Metrics (TODO)
- Prometheus metrics export
- Grafana dashboards
- AlertManager notifications

---

## Deployment

### Docker Compose
- All services containerized
- Networks: crypto-network (bridge)
- Volumes: redis-data, postgres-main-data, timescaledb-data
- Health checks cho dependencies
- Auto-restart policies

### Environment Variables
Required:
- `GROQ_API_KEY`: Groq API key
- `JWT_SECRET`: JWT signing secret
- Database credentials (có defaults)

### CI/CD (TODO)
- GitHub Actions pipeline
- Automated testing
- Docker image builds
- Deployment to cloud (AWS/GCP/Azure)

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | NestJS | Backend framework |
| Language | TypeScript | Type-safe development |
| API Gateway | Express (NestJS) | REST API server |
| WebSocket | ws (native) | Real-time communication |
| Authentication | JWT | Stateless auth |
| ORM | TypeORM | Database abstraction |
| Main Database | PostgreSQL 15 | Users, news, AI insights |
| Time-Series DB | TimescaleDB | OHLCV, ticks |
| Cache/Pub-Sub | Redis 7 | Caching & messaging |
| Message Queue | BullMQ | Background jobs |
| Package Manager | pnpm | Monorepo management |
| Containerization | Docker | Deployment |
| Documentation | Swagger/OpenAPI | API docs |
| External APIs | Binance WS, Groq API | Data sources |

---

## Future Enhancements

### Short-term
1. Rate limiting middleware
2. WebSocket authentication với JWT
3. Prometheus metrics export
4. Unit tests & integration tests
5. Error tracking (Sentry)

### Medium-term
1. GraphQL API gateway
2. Kafka thay Redis Pub/Sub (better scalability)
3. Elasticsearch cho news search
4. Redis Cluster cho high availability
5. Database replication & read replicas

### Long-term
1. Kubernetes deployment
2. Service mesh (Istio)
3. Distributed tracing (Jaeger)
4. Machine learning models (thay Groq API)
5. Real-time alerts & notifications
6. Mobile app push notifications
7. Social features (user portfolios, comments)

---

## Tài Liệu Tham Khảo

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Binance WebSocket API](https://binance-docs.github.io/apidocs/futures/en/)
- [Groq API Documentation](https://console.groq.com/docs)
