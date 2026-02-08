# WebSocket Connection Stability & Message Validation Tests

This directory contains **3 specialized test scripts** to demonstrate and validate that each WebSocket connection is stable and receives the correct messages in real-time.

## 📋 Overview of Solutions

| Solution | Focus | Best For |
|----------|-------|----------|
| **1. Health Monitor** | Connection health, heartbeat, staleness detection | Detecting dead/stale connections, monitoring uptime |
| **2. Message Validator** | Message correctness, sequence validation, symbol accuracy | Ensuring data integrity, catching wrong symbols |
| **3. Real-time Dashboard** | Live metrics, latency tracking, throughput visualization | Performance analysis, real-time monitoring |

---

## 🏥 Solution 1: Health Monitor

**File:** `websocket-health-monitor.js`

### Purpose
Tracks individual connection health with heartbeat monitoring, detects stale connections, and validates that each connection continuously receives expected messages.

### Features
- ✅ **Per-connection health tracking**: Status, uptime, message counts
- 💓 **Heartbeat monitoring**: Detects connections that stop receiving messages
- ⏱️ **Latency measurement**: Tracks average response time per connection
- 📊 **Stale connection detection**: Alerts when connections haven't received messages
- 🏆 **Top performers**: Shows healthiest connections

### Usage
```bash
node websocket-health-monitor.js
```

### Key Metrics
- **Connection status**: connecting → connected → active → receiving_data
- **Heartbeat check**: Every 5 seconds
- **Stale threshold**: No message for 2+ seconds
- **Consecutive timeouts**: Alerts after 3 consecutive missed messages

### Sample Output
```
💓 === HEALTH CHECK ===
🟢 Healthy: 45 (receiving data regularly)
🟡 Stale: 3 (no recent messages)
🔴 Error/Disconnected: 2

📊 === DETAILED CONNECTION STATS ===
Total Connections: 50
Connected: 48 (96%)
Subscribed: 47 (94%)
Actively Receiving: 45 (90%)
Avg Messages/Connection: 127.3
Avg Latency: 45ms
Total Errors: 3

🏆 Top 5 Healthiest Connections:
   1. Client 12: 145 msgs, 42ms latency, btcusdt
   2. Client 7: 143 msgs, 38ms latency, ethusdt
   3. Client 23: 141 msgs, 51ms latency, adausdt
```

### When to Use
- ✅ Verify all connections stay alive during extended tests
- ✅ Detect network issues or server timeouts
- ✅ Monitor connection stability over time
- ✅ Identify problematic connections quickly

---

## 🔍 Solution 2: Message Validator

**File:** `websocket-message-validator.js`

### Purpose
Validates message correctness by checking symbol accuracy, data structure, field completeness, and detecting invalid/duplicate messages.

### Features
- ✅ **Symbol validation**: Ensures each connection receives only their subscribed symbol
- 📋 **Field validation**: Checks for missing required fields (symbol, price, timestamp)
- 🔢 **Data type validation**: Validates price is a valid positive number
- 🎯 **Message sequence tracking**: Detects subscription confirmations
- 📊 **Quality metrics**: Success rate, invalid message count, wrong symbol count
- 🚨 **Error detection**: Catches parse errors, missing fields, wrong symbols

### Usage
```bash
node websocket-message-validator.js
```

### Key Validations
1. **Subscription Confirmation**: Verifies correct symbol in confirm message
2. **Price Updates**: Validates symbol matches subscription
3. **Required Fields**: Checks symbol, price exist in price_update
4. **Data Integrity**: Validates price is valid number > 0
5. **Duplicate Detection**: Tracks identical consecutive prices

### Sample Output
```
🔍 === MESSAGE VALIDATION REPORT ===
📊 Connection Status:
   Total: 30 | Connected: 30 | Subscribed: 30 | Receiving: 29

📨 Message Statistics:
   Total Messages: 1,247
   Price Updates: 1,189
   Avg Updates/Connection: 39.6

✅ Validation Results:
   Correct Symbol Updates: 1,189
   Wrong Symbol Updates: 0
   Invalid Messages: 0
   Missing Fields: 0
   Errors: 0
   SUCCESS RATE: 100.00%

🏆 Top Validated Connections:
   1. Client 5: 47 valid updates, 100.0% accuracy
   2. Client 12: 45 valid updates, 100.0% accuracy
   3. Client 18: 44 valid updates, 100.0% accuracy
```

### When to Use
- ✅ Verify messages contain correct data for each connection
- ✅ Catch symbol mismatches (Client subscribed to BTC but receives ETH)
- ✅ Validate message structure and field completeness
- ✅ Calculate overall accuracy and data quality metrics
- ✅ Detect server-side routing errors

---

## 📊 Solution 3: Real-time Dashboard

**File:** `websocket-realtime-dashboard.js`

### Purpose
Provides live, updating dashboard with comprehensive per-connection metrics including latency distribution, throughput rates, and visual health indicators.

### Features
- 📈 **Live updating dashboard**: Refreshes every 3 seconds
- ⚡ **Latency tracking**: Min, max, avg, P95, P99 percentiles
- 📊 **Throughput metrics**: Messages per second (sent/received)
- 📉 **Latency histogram**: Visual distribution across buckets
- 🎯 **Real-time health status**: 🟢 Healthy | 🟡 Stale | 🔴 Error | ⚫ Disconnected
- 📋 **Per-connection details**: Top 15 connections by activity
- ⚠️ **Problem detection**: Highlights problematic connections

### Usage
```bash
node websocket-realtime-dashboard.js
```

### Key Metrics
- **Aggregate Statistics**: Overall health, avg latency, P95/P99
- **Latency Distribution**: Histogram showing 0-50ms, 50-100ms, etc.
- **Per-connection Table**: Status, uptime, messages, latency, throughput
- **Health Indicators**: Visual status for each connection
- **Data Quality**: Valid vs invalid message counts

### Sample Output
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 WEBSOCKET REAL-TIME DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Uptime: 2:34 | 🌐 Total Connections: 40
📤 Total Sent: 1,234 | 📥 Total Received: 5,678
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 AGGREGATE STATISTICS:
   Status: 🟢 37 | 🟡 2 | 🔴 1 | ⚫ 0
   Avg Latency: 47ms (min: 23ms, max: 189ms)
   P95 Latency: 78ms | P99 Latency: 142ms
   Avg Throughput: ⬆️  0.5/s | ⬇️  3.7/s
   Total Price Updates: 4,523
   Data Quality: ✅ 4,523 valid | ❌ 0 invalid

📊 LATENCY DISTRIBUTION:
   0-50ms       ████████████████████████████████████████ 2,345 (67.8%)
   50-100ms     ██████████████████                       892 (25.8%)
   100-200ms    ████                                     189 (5.5%)
   200-500ms    █                                        32 (0.9%)
   500ms+                                                0 (0.0%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PER-CONNECTION DETAILS (Top 15 by message count):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ID | Status       | Symbol   | Uptime | Msgs Recv | Price Updates | Latency (avg) | Throughput ⬇️  | Health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  5 | subscribed   | btcusdt  |  2:34  |       156 |           145 |          42ms |         3.8/s | 🟢
 12 | subscribed   | ethusdt  |  2:32  |       154 |           143 |          45ms |         3.9/s | 🟢
  7 | subscribed   | adausdt  |  2:33  |       152 |           141 |          38ms |         3.7/s | 🟢
```

### When to Use
- ✅ Real-time monitoring during stress tests
- ✅ Performance analysis and optimization
- ✅ Identifying latency spikes or patterns
- ✅ Visualizing throughput and connection health
- ✅ Demo/presentation of connection stability

---

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies (from stress-test directory)
npm install ws
```

### Running Tests

**Option 1: Health Monitoring (Stability Focus)**
```bash
node websocket-health-monitor.js
```
Best for: Verifying connections stay alive and responsive

**Option 2: Message Validation (Accuracy Focus)**
```bash
node websocket-message-validator.js
```
Best for: Ensuring data correctness and integrity

**Option 3: Real-time Dashboard (Performance Focus)**
```bash
node websocket-realtime-dashboard.js
```
Best for: Live monitoring and performance analysis

### Configuration

Each script has configurable parameters at the top:

```javascript
const TOTAL_CONNECTIONS = 50;        // Number of concurrent connections
const CONNECTION_RAMP_DELAY = 100;   // Delay between connections (ms)
const WS_URL = 'ws://localhost:3000/ws'; // WebSocket server URL
```

---

## 📊 Comparison Matrix

| Feature | Health Monitor | Message Validator | Real-time Dashboard |
|---------|---------------|-------------------|---------------------|
| Connection Stability | ✅✅✅ | ✅ | ✅✅ |
| Message Correctness | ✅ | ✅✅✅ | ✅✅ |
| Latency Tracking | ✅✅ | ❌ | ✅✅✅ |
| Real-time Visualization | ✅ | ✅ | ✅✅✅ |
| Stale Detection | ✅✅✅ | ❌ | ✅✅ |
| Symbol Validation | ✅ | ✅✅✅ | ✅ |
| Throughput Metrics | ❌ | ❌ | ✅✅✅ |
| Data Quality Metrics | ❌ | ✅✅✅ | ✅✅ |
| Latency Percentiles | ❌ | ❌ | ✅✅✅ |
| Live Dashboard | ❌ | ❌ | ✅✅✅ |

**Legend:** ✅✅✅ Excellent | ✅✅ Good | ✅ Basic | ❌ Not Available

---

## 🎯 Recommended Usage

### For Development Testing
```bash
# Use Health Monitor for quick checks
node websocket-health-monitor.js
```

### For Quality Assurance
```bash
# Use Message Validator to ensure correctness
node websocket-message-validator.js
```

### For Performance Testing
```bash
# Use Real-time Dashboard for detailed analysis
node websocket-realtime-dashboard.js
```

### For Comprehensive Testing
Run all three in separate terminals:
```bash
# Terminal 1
node websocket-health-monitor.js

# Terminal 2  
node websocket-message-validator.js

# Terminal 3
node websocket-realtime-dashboard.js
```

---

## 📝 Success Criteria

### ✅ Connection Stability
- [ ] >95% connections in "healthy" status
- [ ] <5% stale connections
- [ ] 0 unexpected disconnections
- [ ] All connections receive heartbeat responses

### ✅ Message Correctness
- [ ] 100% symbol validation success rate
- [ ] 0 wrong symbol updates
- [ ] 0 missing required fields
- [ ] 100% valid price values

### ✅ Real-time Performance
- [ ] Average latency <100ms
- [ ] P95 latency <200ms
- [ ] Consistent throughput >1 msg/sec per connection
- [ ] No latency degradation over time

---

## 🐛 Troubleshooting

### High Error Rate
- Check if WebSocket server is running
- Verify `WS_URL` is correct
- Ensure server can handle connection count

### Stale Connections
- Check server resource limits (CPU, RAM)
- Verify real-time price data is flowing
- Check network connectivity

### Wrong Symbol Updates
- Verify server-side subscription routing
- Check for race conditions in subscription logic
- Ensure symbol normalization (uppercase/lowercase)

### High Latency
- Check network conditions
- Verify server is not overloaded
- Monitor server CPU/memory usage

---

## 💡 Tips

1. **Start Small**: Begin with 10-20 connections, then scale up
2. **Monitor Server**: Watch server logs while running tests
3. **Use Dashboard**: For presentations, use real-time dashboard
4. **Compare Results**: Run multiple tests and compare metrics
5. **Adjust Thresholds**: Tune EXPECTED_MESSAGE_INTERVAL based on your use case

---

## 📚 Additional Resources

- Original stress test: [websocket-crash-test.js](websocket-crash-test.js)
- Architecture docs: [WEBSOCKET_PRICE_ARCHITECTURE.md](../../docs/WEBSOCKET_PRICE_ARCHITECTURE.md)
- Crash testing guide: [CRASH-TESTING.md](CRASH-TESTING.md)
