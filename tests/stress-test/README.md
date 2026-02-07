# WebSocket Stress Test

This test script simulates the exact WebSocket communication protocol used by the frontend application to test your WebSocket server under load.

## Installation

```bash
cd test
npm install ws
```

## Usage

```bash
node websocket-stress-test.js
```

## Message Protocol

Based on frontend analysis, the test sends these message types:

### Client to Server Messages:
- **Subscribe**: `{"type": "subscribe_price", "symbol": "btcusdt"}`
- **Unsubscribe**: `{"type": "unsubscribe_price", "symbol": "ethusdt"}`

### Expected Server to Client Messages:
- **Subscription Confirmed**: `{"type": "subscribed", "symbol": "btcusdt"}`
- **Unsubscription Confirmed**: `{"type": "unsubscribed", "symbol": "ethusdt"}`
- **Price Update**: `{"type": "price_update", "data": {"symbol": "btcusdt", "price": 45000, "timestamp": 1234567890, "change24h": 2.5}}`
- **Error**: `{"type": "error", "message": "error description"}`

## Test Symbols
The test rotates through these crypto symbols:
- btcusdt
- ethusdt  
- adausdt
- bnbusdt
- solusdt

## Configuration
- **TOTAL_CONNECTIONS**: 100 concurrent connections
- **MESSAGE_INTERVAL**: 5 seconds between messages (with randomization)
- **WS_URL**: ws://localhost:3000/ws

## What the Test Does
1. Creates 100 concurrent WebSocket connections
2. Each client subscribes to a random crypto symbol
3. Sends periodic subscribe/unsubscribe messages  
4. Logs all server responses
5. Reports connection statistics every 10 seconds