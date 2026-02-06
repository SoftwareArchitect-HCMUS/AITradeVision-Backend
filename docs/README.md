# AITradeVision Backend Documentation

Chào mừng đến với documentation của AITradeVision Backend - một nền tảng phân tích cryptocurrency real-time với kiến trúc microservices.

## 📚 Tài Liệu Chính

### 1. [ARCHITECTURE.md](./ARCHITECTURE.md)
Tài liệu kiến trúc hệ thống chi tiết:
- Tổng quan kiến trúc microservices
- Sơ đồ kiến trúc tổng thể
- Chi tiết từng service (Web Server, Crawler, Price Collector, AI Service)
- Luồng dữ liệu (Data Flow)
- Design patterns và best practices
- Technology stack
- Scalability strategies

### 2. [API.md](./API.md)
Tài liệu API endpoints đầy đủ:
- Authentication APIs (register, login, VIP upgrade)
- Market Data APIs (OHLCV, ticks, symbols)
- News APIs (crawled articles)
- AI Insights APIs (sentiment analysis, predictions)
- WebSocket API (real-time price updates)
- Request/response examples
- Error handling
- Client code examples (JavaScript, cURL)

### 3. [DATABASE.md](./DATABASE.md)
Schema database chi tiết:
- PostgreSQL Main: users, news, ai_insights, symbols
- TimescaleDB: ohlcv_data, tick_data (hypertables)
- Indexes và optimization
- Entity relationships
- Query examples
- Data volume estimates
- Backup & restore procedures
- Maintenance tasks

### 4. [DEPLOYMENT.md](./DEPLOYMENT.md)
Hướng dẫn deployment:
- Docker Compose deployment (recommended)
- Development setup
- Production deployment (VPS/Cloud)
- Environment variables
- Nginx reverse proxy setup
- SSL/TLS configuration
- Monitoring & logging
- Backup strategies
- Scaling strategies
- Security checklist
- Troubleshooting guide

### 5. [WEBSOCKET_PRICE_ARCHITECTURE.md](./WEBSOCKET_PRICE_ARCHITECTURE.md)
Chi tiết kiến trúc WebSocket real-time price:
- Binance WebSocket integration
- Redis Pub/Sub pattern
- Client WebSocket gateway
- Performance optimization

---

## 🏗️ Kiến Trúc Tóm Tắt

```
Client Apps (Web/Mobile)
         ↓
   Web Server (API + WebSocket Gateway)
         ↓
   Redis Pub/Sub + BullMQ
         ↓
   ┌────────┬───────────┬──────────────┐
   ↓        ↓           ↓              ↓
Crawler  Price      AI Service   Databases
Service  Collector                (PostgreSQL
                                  + TimescaleDB)
```

### Core Services
1. **Web Server** (Port 3000): REST API & WebSocket gateway
2. **Crawler Service** (Port 3002): News crawling từ Bloomberg, Reuters, Cointelegraph, CNBC
3. **Price Collector** (Port 3003): Real-time price data từ Binance WebSocket
4. **AI Service** (Port 3001): AI analysis sử dụng Groq API

### Databases
- **PostgreSQL Main**: Users, news, AI insights
- **TimescaleDB**: Time-series OHLCV và tick data
- **Redis**: Pub/Sub messaging, caching, BullMQ queue

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/SoftwareArchitect-HCMUS/AITradeVision-Backend.git
cd AITradeVision-Backend

# Setup environment
cp .env.example .env
# Edit .env với GROQ_API_KEY

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Access API docs
open http://localhost:3000/api
```

Chi tiết xem [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📊 Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | NestJS (TypeScript) |
| API Gateway | Express + Native WebSocket |
| Authentication | JWT |
| ORM | TypeORM |
| Main Database | PostgreSQL 15 |
| Time-Series DB | TimescaleDB |
| Cache/Pub-Sub | Redis 7 |
| Message Queue | BullMQ |
| Package Manager | pnpm (monorepo) |
| Containerization | Docker |
| External APIs | Binance WebSocket, Groq API |

---

## 🔑 Key Features

- ✅ **Real-time Price Updates**: WebSocket streaming từ Binance
- ✅ **News Aggregation**: Automated crawling mỗi 5 phút
- ✅ **AI Analysis**: Sentiment analysis & predictions với Groq
- ✅ **Time-Series Optimization**: TimescaleDB hypertables
- ✅ **Event-Driven Architecture**: Redis Pub/Sub
- ✅ **Microservices**: 4 independent services
- ✅ **Docker Ready**: Full Docker Compose setup
- ✅ **API Documentation**: Swagger UI
- ✅ **Scalable**: Horizontal scaling support

---

## 📈 Data Flow

### Price Data Flow
```
Binance WS → Price Collector → TimescaleDB
                             ↓
                         Redis Pub/Sub
                             ↓
                    Web Server Gateway
                             ↓
                    Client WebSocket
```

### News & AI Analysis Flow
```
News Sources → Crawler (BullMQ) → PostgreSQL
                                      ↓
                                Redis Pub/Sub
                                      ↓
                                 AI Service
                                      ↓
                            Groq API Analysis
                                      ↓
                            AI Insights (PostgreSQL)
```

---

## 🔐 Security

- JWT authentication cho protected endpoints
- VIP-only access cho AI insights
- bcrypt password hashing
- Input validation với class-validator
- CORS configuration
- SQL injection prevention (TypeORM parameterized queries)

Chi tiết xem [DEPLOYMENT.md - Security Checklist](./DEPLOYMENT.md#7-security-checklist)

---

## 📦 Project Structure

```
AITradeVision-Backend/
├── apps/
│   ├── web-server/        # REST API + WebSocket Gateway
│   ├── crawler/           # News crawling service
│   ├── price-collector/   # Binance price collector
│   └── ai-service/        # AI analysis service
├── libs/
│   └── shared/            # Shared DTOs, events, types
├── docs/                  # Documentation (this folder)
├── scripts/               # Database scripts
├── docker-compose.yml     # Docker orchestration
└── package.json           # Monorepo configuration
```

---

## 🧪 Testing

```bash
# Run tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

---

## 📊 Monitoring

- Health checks trong docker-compose
- Structured logging với NestJS Logger
- Optional: Prometheus + Grafana setup

Chi tiết xem [DEPLOYMENT.md - Monitoring](./DEPLOYMENT.md#4-monitoring--logging)

---

## 🤝 API Examples

### Get Market Data
```bash
curl http://localhost:3000/market/ohlcv/BTCUSDT?timeframe=1h&limit=24
```

### Subscribe to Real-time Prices
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.send(JSON.stringify({ type: 'subscribe_price', symbol: 'BTCUSDT' }));
```

### Get AI Insights (VIP)
```bash
curl http://localhost:3000/ai/insights/BTCUSDT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Xem thêm examples trong [API.md](./API.md)

---

## 🛠️ Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Local Development
```bash
# Install dependencies
pnpm install

# Start databases only
docker-compose up -d redis postgres_main timescaledb

# Run services in dev mode
pnpm --filter @crypto/web-server start:dev
pnpm --filter @crypto/ai-service start:dev
pnpm --filter @crypto/crawler-service start:dev
pnpm --filter @crypto/price-collector-service start:dev
```

---

## 🐛 Troubleshooting

Common issues và solutions trong [DEPLOYMENT.md - Troubleshooting](./DEPLOYMENT.md#8-troubleshooting)

---

## 📝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push branch: `git push origin feature/my-feature`
5. Submit Pull Request

---

## 📞 Support

- **GitHub Issues**: https://github.com/SoftwareArchitect-HCMUS/AITradeVision-Backend/issues
- **Main README**: [../README.md](../README.md)
- **API Documentation**: http://localhost:3000/api (Swagger UI)

---

## 📄 License

This project is licensed under the MIT License.

---

## 🎯 Future Enhancements

### Short-term
- [ ] Rate limiting middleware
- [ ] WebSocket JWT authentication
- [ ] Unit & integration tests
- [ ] Error tracking (Sentry)

### Medium-term
- [ ] GraphQL API
- [ ] Kafka for messaging (thay Redis Pub/Sub)
- [ ] Elasticsearch for news search
- [ ] Redis Cluster
- [ ] Database replication

### Long-term
- [ ] Kubernetes deployment
- [ ] Service mesh (Istio)
- [ ] Distributed tracing (Jaeger)
- [ ] Machine learning models
- [ ] Mobile push notifications
- [ ] Social features

---

**Cập nhật lần cuối**: January 2024

**Phiên bản**: 1.0.0

