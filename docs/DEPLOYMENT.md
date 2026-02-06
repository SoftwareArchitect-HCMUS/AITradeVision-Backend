# Deployment Guide

## Tổng Quan

Hệ thống AITradeVision Backend có thể được deploy theo nhiều cách:
1. **Docker Compose** (Recommended cho development & single-server production)
2. **Kubernetes** (Recommended cho production scale-out)
3. **Manual Deployment** (Không khuyến khích)

---

## 1. Docker Compose Deployment

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- 4GB RAM minimum (8GB recommended)
- 50GB disk space

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/SoftwareArchitect-HCMUS/AITradeVision-Backend.git
cd AITradeVision-Backend

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your configuration
nano .env

# 4. Start all services
docker-compose up -d

# 5. Check logs
docker-compose logs -f

# 6. Check health
docker-compose ps
```

### Environment Variables

**Required**:
```bash
# Groq API Key (Get from https://console.groq.com/keys)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# JWT Secret (Generate with: openssl rand -base64 32)
JWT_SECRET=your-random-secret-key-here
```

**Database Configuration** (có defaults):
```bash
# PostgreSQL Main
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
```

**Optional**:
```bash
# Node environment
NODE_ENV=production

# Service ports (if changing from defaults)
WEB_SERVER_PORT=3000
AI_SERVICE_PORT=3001
CRAWLER_PORT=3002
PRICE_COLLECTOR_PORT=3003

# Binance WebSocket URLs
BINANCE_WS_URL=wss://fstream.binance.com/ws
BINANCE_SPOT_WS_URL=wss://stream.binance.com:9443/ws
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │   Redis    │  │ PostgreSQL │  │    TimescaleDB       │ │
│  │ Port: 6379 │  │ Port: 5432 │  │    Port: 5433        │ │
│  └────────────┘  └────────────┘  └──────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Application Services                    │  │
│  │                                                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │  │
│  │  │   Web    │ │    AI    │ │ Crawler│ │  Price   │ │  │
│  │  │  Server  │ │ Service  │ │ Service│ │Collector │ │  │
│  │  │   :3000  │ │  :3001   │ │  :3002 │ │  :3003   │ │  │
│  │  └──────────┘ └──────────┘ └────────┘ └──────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart web-server

# View logs
docker-compose logs -f web-server
docker-compose logs -f ai-service
docker-compose logs -f crawler-service
docker-compose logs -f price-collector-service

# Scale a service (if using load balancer)
docker-compose up -d --scale web-server=3

# Rebuild after code changes
docker-compose build
docker-compose up -d

# Clean up everything (including volumes)
docker-compose down -v

# Check resource usage
docker stats
```

### Health Checks

```bash
# Check if all services are healthy
docker-compose ps

# Expected output:
# NAME                    STATUS
# crypto-redis            Up (healthy)
# crypto-postgres-main    Up (healthy)
# crypto-timescaledb      Up (healthy)
# crypto-web-server       Up
# crypto-ai-service       Up
# crypto-crawler          Up
# crypto-price-collector  Up

# Test API endpoint
curl http://localhost:3000/api

# Test WebSocket
wscat -c ws://localhost:3000/ws
```

---

## 2. Development Setup (Without Docker)

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 15
- TimescaleDB (PostgreSQL + TimescaleDB extension)
- Redis 7

### Step-by-Step

```bash
# 1. Install dependencies
pnpm install

# 2. Setup databases
# Start PostgreSQL and Redis locally
# Or use Docker for databases only:
docker-compose up -d redis postgres_main timescaledb

# 3. Run database migrations
psql -h localhost -p 5432 -U crypto_user -d crypto_main \
  -f scripts/init-main-db.sql

psql -h localhost -p 5433 -U timescale_user -d timescale_db \
  -f scripts/init-timescale-db.sql

# 4. Seed data
psql -h localhost -p 5432 -U crypto_user -d crypto_main \
  -f scripts/seed-symbols.sql

# 5. Create .env
cp .env.example .env
# Edit .env with local database credentials

# 6. Start services in development mode
# Terminal 1: Web Server
pnpm --filter @crypto/web-server start:dev

# Terminal 2: AI Service
pnpm --filter @crypto/ai-service start:dev

# Terminal 3: Crawler Service
pnpm --filter @crypto/crawler-service start:dev

# Terminal 4: Price Collector Service
pnpm --filter @crypto/price-collector-service start:dev
```

### Build for Production

```bash
# Build all services
pnpm build

# Start production mode
pnpm start:prod
```

---

## 3. Production Deployment (VPS/Cloud)

### Server Requirements

**Minimum**:
- 2 CPU cores
- 4GB RAM
- 50GB SSD
- Ubuntu 22.04 LTS

**Recommended**:
- 4 CPU cores
- 8GB RAM
- 100GB SSD
- Ubuntu 22.04 LTS

### Setup on Ubuntu Server

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 3. Install Docker Compose
sudo apt install docker-compose-plugin -y

# 4. Clone repository
git clone https://github.com/SoftwareArchitect-HCMUS/AITradeVision-Backend.git
cd AITradeVision-Backend

# 5. Setup environment
cp .env.example .env
nano .env
# Set GROQ_API_KEY and strong JWT_SECRET

# 6. Start services
docker-compose up -d

# 7. Setup firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # Web Server API
sudo ufw enable

# 8. Setup reverse proxy (Nginx)
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/aitradevision
```

**Nginx Configuration**:
```nginx
upstream api_backend {
    server localhost:3000;
    # If scaling: add more servers
    # server localhost:3001;
}

server {
    listen 80;
    server_name api.aitradevision.com;

    # API endpoints
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/aitradevision /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.aitradevision.com
```

### Systemd Service (Auto-restart)

Create `/etc/systemd/system/aitradevision.service`:
```ini
[Unit]
Description=AITradeVision Backend
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/AITradeVision-Backend
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable auto-start on boot
sudo systemctl enable aitradevision
sudo systemctl start aitradevision
sudo systemctl status aitradevision
```

---

## 4. Monitoring & Logging

### Log Management

```bash
# View logs
docker-compose logs -f

# Save logs to file
docker-compose logs > logs.txt

# Rotate logs (setup with logrotate)
sudo nano /etc/logrotate.d/aitradevision
```

**/etc/logrotate.d/aitradevision**:
```
/home/ubuntu/AITradeVision-Backend/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 0644 root root
}
```

### Monitoring with Prometheus (Optional)

**docker-compose.monitoring.yml**:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - crypto-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3050:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - crypto-network

volumes:
  prometheus-data:
  grafana-data:

networks:
  crypto-network:
    external: true
```

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
open http://localhost:3050
# Default login: admin / admin
```

---

## 5. Backup & Restore

### Automated Backup Script

**backup.sh**:
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL Main
docker exec crypto-postgres-main pg_dump -U crypto_user crypto_main \
  > $BACKUP_DIR/postgres_main_$DATE.sql

# Backup TimescaleDB
docker exec crypto-timescaledb pg_dump -U timescale_user timescale_db \
  > $BACKUP_DIR/timescaledb_$DATE.sql

# Backup Redis (RDB snapshot)
docker exec crypto-redis redis-cli SAVE
docker cp crypto-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Compress
cd $BACKUP_DIR
tar -czf backup_$DATE.tar.gz *_$DATE.*
rm *_$DATE.sql *_$DATE.rdb

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

```bash
# Make executable
chmod +x backup.sh

# Setup cron job (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/ubuntu/AITradeVision-Backend/backup.sh
```

### Restore from Backup

```bash
# 1. Stop services
docker-compose down

# 2. Extract backup
cd /home/ubuntu/backups
tar -xzf backup_20240115_020000.tar.gz

# 3. Restore PostgreSQL Main
docker-compose up -d postgres_main
cat postgres_main_20240115_020000.sql | \
  docker exec -i crypto-postgres-main psql -U crypto_user crypto_main

# 4. Restore TimescaleDB
docker-compose up -d timescaledb
cat timescaledb_20240115_020000.sql | \
  docker exec -i crypto-timescaledb psql -U timescale_user timescale_db

# 5. Restore Redis
docker-compose up -d redis
docker cp redis_20240115_020000.rdb crypto-redis:/data/dump.rdb
docker-compose restart redis

# 6. Start all services
docker-compose up -d
```

---

## 6. Scaling Strategies

### Horizontal Scaling

**Scale Web Server**:
```bash
# Edit docker-compose.yml
# Remove port mapping from web-server service
# Use Nginx as load balancer

# Start multiple instances
docker-compose up -d --scale web-server=3

# Update Nginx upstream
upstream api_backend {
    server web-server-1:3000;
    server web-server-2:3000;
    server web-server-3:3000;
}
```

**Scale Crawler Service**:
```yaml
crawler-service:
  deploy:
    replicas: 2
    resources:
      limits:
        cpus: '1'
        memory: 512M
```

**Scale AI Service**:
```bash
docker-compose up -d --scale ai-service=2
# Each instance processes news:created events independently
```

### Database Scaling

**PostgreSQL Read Replicas**:
```yaml
postgres_replica:
  image: postgres:15-alpine
  environment:
    POSTGRES_USER: crypto_user
    POSTGRES_PASSWORD: crypto_pass
  volumes:
    - postgres-replica-data:/var/lib/postgresql/data
  command: |
    postgres
    -c wal_level=replica
    -c hot_standby=on
```

**Redis Cluster**:
```bash
# Use Redis Cluster for high availability
# See: https://redis.io/docs/management/scaling/
```

**TimescaleDB Multi-Node** (Enterprise feature):
```bash
# For large-scale deployments
# See: https://docs.timescale.com/self-hosted/latest/multinode-timescaledb/
```

---

## 7. Security Checklist

### Application Security

- [ ] Change default passwords in `.env`
- [ ] Use strong JWT secret (32+ characters)
- [ ] Enable HTTPS (SSL/TLS certificates)
- [ ] Implement rate limiting
- [ ] Add API key authentication for sensitive endpoints
- [ ] Regular security updates: `docker-compose pull && docker-compose up -d`

### Database Security

- [ ] Change default database passwords
- [ ] Restrict database access to localhost only
- [ ] Enable SSL for database connections
- [ ] Regular backups (automated)
- [ ] Encrypt backups

### Server Security

- [ ] Setup firewall (UFW)
- [ ] Disable root SSH login
- [ ] Use SSH keys instead of passwords
- [ ] Install fail2ban
- [ ] Regular system updates: `sudo apt update && sudo apt upgrade`
- [ ] Monitor logs for suspicious activity

```bash
# Setup fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Network Security

```bash
# Firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Check open ports
sudo netstat -tulpn
```

---

## 8. Troubleshooting

### Common Issues

**1. Services not starting**:
```bash
# Check logs
docker-compose logs

# Check if ports are in use
sudo netstat -tulpn | grep LISTEN

# Restart services
docker-compose restart
```

**2. Database connection errors**:
```bash
# Check database health
docker-compose ps

# Test connection
docker exec -it crypto-postgres-main psql -U crypto_user -d crypto_main

# Check environment variables
docker exec crypto-web-server env | grep POSTGRES
```

**3. Out of memory**:
```bash
# Check memory usage
docker stats

# Limit memory per service in docker-compose.yml
services:
  web-server:
    mem_limit: 512m
    mem_reservation: 256m
```

**4. Disk space full**:
```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean logs
docker-compose logs --tail=0 | tee /dev/null
```

**5. WebSocket not connecting**:
```bash
# Check if WebSocket port is accessible
telnet localhost 3000

# Test WebSocket
wscat -c ws://localhost:3000/ws

# Check Nginx WebSocket configuration
sudo nginx -t
```

### Debug Mode

```bash
# Enable debug logging
# Edit .env
NODE_ENV=development
LOG_LEVEL=debug

# Restart services
docker-compose restart

# View detailed logs
docker-compose logs -f --tail=100
```

---

## 9. Performance Optimization

### Database Tuning

**PostgreSQL**:
```bash
# Edit PostgreSQL config
docker exec -it crypto-postgres-main bash
nano /var/lib/postgresql/data/postgresql.conf

# Recommended settings for 8GB RAM:
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 32MB
```

**TimescaleDB Compression**:
```sql
-- Enable compression for old data
ALTER TABLE ohlcv_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol,timeframe'
);

SELECT add_compression_policy('ohlcv_data', INTERVAL '7 days');
```

### Application Tuning

**Connection Pooling**:
```typescript
// Increase pool size for high traffic
TypeOrmModule.forRoot({
  poolSize: 50,  // Default: 10
  extra: {
    max: 50,
    min: 10,
  }
});
```

**Redis Caching**:
```typescript
// Increase cache TTL for static data
await redis.setex('symbols', 3600, JSON.stringify(symbols));  // 1 hour
```

---

## 10. CI/CD Pipeline (GitHub Actions)

**.github/workflows/deploy.yml**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/ubuntu/AITradeVision-Backend
            git pull origin main
            docker-compose build
            docker-compose up -d
            docker-compose ps
```

---

## Support

- GitHub Issues: https://github.com/SoftwareArchitect-HCMUS/AITradeVision-Backend/issues
- Documentation: [See README.md](../README.md)
- API Docs: http://localhost:3000/api
