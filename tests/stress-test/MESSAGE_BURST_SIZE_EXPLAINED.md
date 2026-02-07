# 📚 MESSAGE_BURST_SIZE Explanation

## 🎯 **What is MESSAGE_BURST_SIZE?**

`MESSAGE_BURST_SIZE` controls **how many messages are sent in rapid succession** during each interval timer tick.

## 🔄 **How It Works:**

```javascript
const MESSAGE_BURST_SIZE = 10;  // Send 10 messages per burst
const MESSAGE_INTERVAL = 1000;  // Wait 1000ms between bursts

// Timeline:
// Time 0ms:    Send 10 messages immediately (burst)
// Time 1000ms: Send 10 messages immediately (burst)  
// Time 2000ms: Send 10 messages immediately (burst)
// ...and so on
```

## 📊 **Examples:**

### **Scenario 1: Single Message Per Interval**
```javascript
MESSAGE_BURST_SIZE = 1
MESSAGE_INTERVAL = 1000  // 1 second
```
**Result**: 1 message every second = **1 msg/sec**

### **Scenario 2: Burst of 10 Messages** 
```javascript
MESSAGE_BURST_SIZE = 10
MESSAGE_INTERVAL = 1000  // 1 second
```
**Result**: 10 messages every second = **10 msg/sec**

### **Scenario 3: High-Frequency Bursts**
```javascript  
MESSAGE_BURST_SIZE = 5
MESSAGE_INTERVAL = 100   // 100ms
```
**Result**: 5 messages every 100ms = **50 msg/sec**

## 🚀 **Your Current Test Setup:**

```javascript
MESSAGE_BURST_SIZE = 1
MESSAGE_INTERVAL = 1000
```

**Analysis**: 
- Sends **1 message every 1 second**
- Low frequency, good for **steady sustained load**
- **NOT aggressive** - very conservative testing

## ⚡ **For Aggressive Testing, Try:**

```javascript
// High burst, low interval = Maximum stress
MESSAGE_BURST_SIZE = 50   // 50 messages per burst
MESSAGE_INTERVAL = 10     // Every 10ms

// Result: 50 messages every 10ms = 5000 msg/sec theoretical
```

## 🎯 **Use Cases:**

| Pattern | Best For |
|---------|----------|
| `BURST_SIZE=1, INTERVAL=1000` | **Steady load** testing |
| `BURST_SIZE=10, INTERVAL=100` | **Moderate burst** testing |
| `BURST_SIZE=100, INTERVAL=10` | **Extreme stress** testing |
| `BURST_SIZE=1, INTERVAL=1` | **High frequency** single messages |

## 💡 **Why Use Bursts?**

1. **Realistic Traffic**: Real users often send multiple actions quickly
2. **Buffer Testing**: Tests WebSocket message queuing  
3. **Memory Pressure**: Rapid bursts can overwhelm server buffers
4. **Concurrency Testing**: Multiple messages in flight simultaneously

Your current setup is very **conservative** - try increasing `MESSAGE_BURST_SIZE` to 10 or reducing `MESSAGE_INTERVAL` to 100 for more aggressive testing! 🔥