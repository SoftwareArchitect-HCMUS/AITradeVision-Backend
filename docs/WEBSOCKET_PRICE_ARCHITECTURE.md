# Kiến Trúc WebSocket Price Real-time - Tài Liệu Phỏng Vấn

## 📋 Tổng Quan

Hệ thống real-time price streaming sử dụng kiến trúc **Pub/Sub** với Redis làm message broker, cho phép nhiều clients nhận price updates từ Binance một cách hiệu quả.

## 🏗️ Kiến Trúc Tổng Quan

```
┌─────────────┐      WebSocket      ┌──────────────────┐
│   Binance   │ ──────────────────> │ Price Collector  │
│   Exchange  │                     │    Service       │
└─────────────┘                     └────────┬─────────┘
                                             │
                                             │ Redis PUBLISH
                                             │ (price.btcusdt)
                                             ▼
                                    ┌─────────────────┐
                                    │      Redis      │
                                    │   Pub/Sub       │
                                    └────────┬────────┘
                                             │
                                             │ Redis SUBSCRIBE
                                             │ (price.btcusdt)
                                             ▼
                                    ┌──────────────────┐
                                    │   Web Server     │
                                    │  Price Gateway   │
                                    └────────┬─────────┘
                                             │
                                             │ WebSocket
                                             │ (ws://host:3000/ws)
                                             ▼
                                    ┌──────────────────┐
                                    │   Client App     │
                                    │  (Frontend)      │
                                    └──────────────────┘
```

## 🔄 Luồng Dữ Liệu Chi Tiết

### **Bước 1: Price Collector Service - Kết nối Binance WebSocket**

**Service:** `apps/price-collector/src/binance/binance.service.ts`

```typescript
// Kết nối đến Binance Futures WebSocket
const url = `wss://fstream.binance.com/stream?streams=btcusdt@kline_1m/ethusdt@kline_1m/...`;

// Nhận message từ Binance
futuresWS.on('message', (data) => {
  handleFuturesMessage(data.toString());
});
```

**Xử lý message từ Binance:**
- Parse kline data (OHLCV)
- Extract: symbol, price (close), timestamp, volume
- Tạo `PriceUpdate` object

### **Bước 2: Publish vào Redis Pub/Sub**

**Service:** `apps/price-collector/src/redis/redis.service.ts`

```typescript
async publishPriceUpdate(update: PriceUpdate): Promise<void> {
  // Channel format: "price.btcusdt"
  const channel = `price.${update.symbol.toLowerCase()}`;
  
  // Publish JSON string vào Redis channel
  await this.publisher.publish(channel, JSON.stringify(update));
}
```

**Channel naming pattern:**
- Format: `price.{symbol}` (ví dụ: `price.btcusdt`, `price.ethusdt`)
- Mỗi symbol có channel riêng → cho phép subscribe/unsubscribe linh hoạt

**⚠️ Quan trọng: Redis Pub/Sub là Fire-and-Forget**
- Price Collector **luôn publish** ngay khi nhận data từ Binance
- **Không quan tâm** có subscriber hay không
- Nếu **không có subscriber**, message sẽ **bị drop** (mất)
- Đây là behavior mặc định của Redis Pub/Sub

### **Bước 3: Web Server - Subscribe Redis Channel (Lazy Subscription)**

**Service:** `apps/web-server/src/price-gateway/redis.service.ts`

**Timing quan trọng:**
- Web Server **KHÔNG subscribe** Redis channel khi start
- Chỉ subscribe khi **client gửi `subscribe_price` message**
- → **Lazy subscription pattern**: chỉ subscribe khi cần

**Service:** `apps/web-server/src/price-gateway/redis.service.ts`

```typescript
subscribeToPrice(symbol: string, callback: (update: PriceUpdate) => void): void {
  const channel = `price.${symbol.toLowerCase()}`;
  
  // Subscribe vào Redis channel
  this.subscriber.subscribe(channel);
  
  // Lắng nghe message từ Redis
  this.subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      const update = JSON.parse(message) as PriceUpdate;
      callback(update); // Gọi callback để forward đến WebSocket client
    }
  });
}
```

### **Bước 4: WebSocket Gateway - Forward đến Client**

**Service:** `apps/web-server/src/price-gateway/price.gateway.ts`

**Khi client subscribe:**
```typescript
// Client gửi: { type: 'subscribe_price', symbol: 'BTCUSDT' }

// Gateway subscribe Redis và forward updates
this.redisService.subscribeToPrice(symbol, (update: PriceUpdate) => {
  // Forward price update đến WebSocket client
  this.sendMessage(client, {
    type: 'price_update',
    symbol: symbol,
    data: update
  });
});
```

**Khi nhận price update từ Redis:**
- Parse `PriceUpdate` từ Redis message
- Forward ngay lập tức đến WebSocket client đã subscribe
- Format: `{ type: 'price_update', symbol: 'btcusdt', data: { price, timestamp, volume } }`

## ⚠️ Redis Pub/Sub Behavior - Điểm Quan Trọng

### **Timing của Subscription**

```
Time 0: Price Collector start → Publish price.btcusdt (nhưng chưa có subscriber)
        → Message bị drop ❌

Time 1: Client connect WebSocket → Chưa subscribe gì
        → Vẫn chưa có subscriber

Time 2: Client gửi { type: 'subscribe_price', symbol: 'BTCUSDT' }
        → Web Server subscribe Redis channel 'price.btcusdt'
        → Từ giờ mới nhận được updates ✅
```

**Kết luận:**
- Trước khi client subscribe: Price Collector vẫn publish nhưng **không ai nhận** (message bị drop)
- Sau khi client subscribe: Web Server mới bắt đầu nhận updates từ Redis
- **Redis Pub/Sub không lưu trữ messages** → messages trước khi subscribe sẽ bị mất

**Tại sao thiết kế như vậy?**
- ✅ **Efficiency**: Không subscribe channels không cần thiết
- ✅ **Resource saving**: Chỉ consume messages khi có client thực sự cần
- ✅ **Real-time focus**: Chỉ quan tâm updates từ thời điểm subscribe

**Trade-off:**
- ❌ Client sẽ **không nhận được** price updates trước khi subscribe
- ❌ Nếu muốn lưu trữ messages, cần dùng **Redis Streams** thay vì Pub/Sub

## 🎯 Các Điểm Kỹ Thuật Quan Trọng

### 1. **Tách biệt Publisher và Subscriber**

- **Price Collector**: Chỉ PUBLISH (không subscribe)
- **Web Server**: Chỉ SUBSCRIBE (không publish)
- → Giảm coupling, dễ scale

### 2. **Channel-based Subscription**

- Mỗi symbol có channel riêng: `price.btcusdt`
- Client có thể subscribe nhiều symbols
- Unsubscribe không ảnh hưởng symbols khác

### 3. **Client Management**

```typescript
// Map client → Set of subscribed symbols
private clientSubscriptions: Map<WebSocket, Set<string>> = new Map();

// Mỗi client có thể subscribe nhiều symbols
subscriptions.add('btcusdt');
subscriptions.add('ethusdt');
```

### 4. **Error Handling & Reconnection**

**Price Collector:**
- Exponential backoff khi mất kết nối Binance
- Max 10 reconnection attempts
- Auto-reconnect khi WebSocket đóng

**Web Server:**
- Validate message format
- Handle WebSocket errors gracefully
- Cleanup subscriptions khi client disconnect

### 5. **Performance Optimization**

- **Real-time updates**: Publish ngay khi nhận từ Binance (không đợi candle close)
- **Selective subscription**: Chỉ subscribe symbols client cần
- **Connection pooling**: Redis connection được reuse

## 📊 Data Flow Example

### **Scenario: Client muốn theo dõi BTCUSDT price**

1. **Client → Web Server:**
   ```json
   { "type": "subscribe_price", "symbol": "BTCUSDT" }
   ```

2. **Web Server → Redis:**
   - Subscribe channel: `price.btcusdt`

3. **Binance → Price Collector:**
   ```json
   {
     "e": "kline",
     "k": {
       "s": "BTCUSDT",
       "c": "45000.50",
       "T": 1234567890
     }
   }
   ```

4. **Price Collector → Redis:**
   ```json
   {
     "symbol": "BTCUSDT",
     "price": 45000.50,
     "timestamp": 1234567890,
     "volume": 123.45
   }
   ```
   Published to channel: `price.btcusdt`

5. **Redis → Web Server:**
   - Receive message từ channel `price.btcusdt`
   - Parse `PriceUpdate` object

6. **Web Server → Client:**
   ```json
   {
     "type": "price_update",
     "symbol": "btcusdt",
     "data": {
       "symbol": "BTCUSDT",
       "price": 45000.50,
       "timestamp": 1234567890,
       "volume": 123.45
     }
   }
   ```

## 🔑 Key Points để Trình Bày

### **1. Tại sao dùng Redis Pub/Sub?**

- **Decoupling**: Price Collector và Web Server độc lập
- **Scalability**: Có thể scale Web Server instances mà không ảnh hưởng Price Collector
- **Reliability**: Redis đảm bảo message delivery
- **Flexibility**: Nhiều services có thể subscribe cùng lúc

### **2. Tại sao không kết nối trực tiếp Binance → Client?**

- **Rate limiting**: Binance có giới hạn connections
- **Resource management**: Quản lý connections tập trung
- **Business logic**: Có thể thêm filtering, transformation
- **Security**: Không expose Binance API trực tiếp

### **3. Lợi ích của kiến trúc này:**

✅ **Scalability**: Scale Web Server instances độc lập  
✅ **Reliability**: Redis đảm bảo message persistence  
✅ **Flexibility**: Dễ thêm features (filtering, aggregation)  
✅ **Performance**: Low latency, real-time updates  
✅ **Maintainability**: Tách biệt concerns rõ ràng  

## 💻 Code References

### Price Collector - Publish
```189:199:apps/price-collector/src/binance/binance.service.ts
        // Publish price update to Redis (always, for real-time updates)
        const priceUpdate: PriceUpdate = {
          symbol,
          price: ohlcv.close,
          timestamp: kline.T || Date.now(),
          volume: ohlcv.volume,
        };

        console.log('Price update:', priceUpdate);
        await this.redisService.publishPriceUpdate(priceUpdate);
        console.log('Price update published to Redis');
```

### Redis Service - Publish
```39:47:apps/price-collector/src/redis/redis.service.ts
  async publishPriceUpdate(update: PriceUpdate): Promise<void> {
    try {
      const channel = `${REDIS_CHANNELS.PRICE_UPDATE}.${update.symbol.toLowerCase()}`;
      await this.publisher.publish(channel, JSON.stringify(update));
    } catch (error) {
      this.logger.error('Failed to publish price update', error);
      throw error;
    }
  }
```

### Web Server - Subscribe Redis
```40:64:apps/web-server/src/price-gateway/redis.service.ts
  subscribeToPrice(symbol: string, callback: (update: PriceUpdate) => void): void {
    const channel = `${REDIS_CHANNELS.PRICE_UPDATE}.${symbol.toLowerCase()}`;
    
    this.subscriber.subscribe(channel, (err, count) => {
      if (err) {
        this.logger.error(`❌ Failed to subscribe to channel: ${channel}`, err);
      } else {
        this.logger.log(`📡 Successfully subscribed to ${channel}. Total channels: ${count}`);
      }
    });
    
    this.subscriber.on('message', (ch, message) => {
      this.logger.debug(`📨 Redis message received on ${ch}: ${message}`);
      if (ch === channel) {
        try {
          const update = JSON.parse(message) as PriceUpdate;
          callback(update);
        } catch (error) {
          this.logger.error('Error parsing price update', error);
        }
      }
    });

    this.logger.log(`Subscribed to price updates for ${symbol}`);
  }
```

### WebSocket Gateway - Forward to Client
```176:183:apps/web-server/src/price-gateway/price.gateway.ts
    this.redisService.subscribeToPrice(symbolLower, (update: PriceUpdate) => {
      this.logger.debug(`💰 Received price update from Redis for ${symbolLower}: ${update.price} (client: ${clientId})`);
      this.sendMessage(client, {
        type: 'price_update',
        symbol: symbolLower,
        data: update,
      });
    });
```

## 🎤 Câu Hỏi Thường Gặp trong Phỏng Vấn

**Q: Trước khi client subscribe, Price Collector có publish không? Message có bị mất không?**  
A: 
- ✅ Price Collector **luôn publish** ngay khi nhận từ Binance
- ❌ Nhưng nếu **chưa có subscriber**, message sẽ **bị drop** (mất)
- Đây là behavior của Redis Pub/Sub (fire-and-forget)
- Chỉ từ thời điểm client subscribe, Web Server mới bắt đầu nhận updates
- → Trade-off: Efficiency vs Message persistence

**Q: Có cách nào không mất messages không?**  
A: Có, có thể:
- Dùng **Redis Streams** thay vì Pub/Sub (có persistence)
- Hoặc **pre-subscribe** tất cả symbols khi Web Server start (nhưng tốn resource)
- Hoặc dùng **message queue** như RabbitMQ với persistence

**Q: Nếu Redis down thì sao?**  
A: Price Collector vẫn nhận data từ Binance nhưng không publish được. Web Server không nhận updates. Cần implement Redis failover hoặc message queue backup.

**Q: Làm sao handle khi có nhiều Web Server instances?**  
A: Mỗi instance subscribe độc lập vào Redis. Redis Pub/Sub broadcast message đến tất cả subscribers → mỗi instance forward đến clients của mình.

**Q: Có giới hạn số lượng symbols không?**  
A: Không có hard limit, nhưng cần cân nhắc:
- Binance WebSocket có limit số streams
- Redis memory cho channels
- Network bandwidth

**Q: Làm sao optimize khi có 1000+ clients?**  
A: 
- Connection pooling
- Batch updates nếu cần
- Load balancing Web Server instances
- Redis clustering nếu cần

---

**Good luck với phỏng vấn! 🚀**
