const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3000/ws';
const TOTAL_CONNECTIONS = 40;
const CONNECTION_RAMP_DELAY = 100;
const DASHBOARD_UPDATE_INTERVAL = 3000;
const LATENCY_PING_INTERVAL = 10000; // Measure latency every 10s

const TEST_SYMBOLS = ['btcusdt', 'ethusdt', 'adausdt', 'bnbusdt', 'solusdt', 'dotusdt'];

// Track real-time metrics for each connection
const connectionMetrics = new Map();
let globalStats = {
  startTime: Date.now(),
  totalMessagesSent: 0,
  totalMessagesReceived: 0,
};

console.log(`📊 WebSocket Real-Time Dashboard - ${TOTAL_CONNECTIONS} connections`);
console.log(`📈 Tracking: Latency, throughput, message rates, connection stability\n`);

for (let i = 0; i < TOTAL_CONNECTIONS; i++) {
  setTimeout(() => createDashboardConnection(i), i * CONNECTION_RAMP_DELAY);
}

function createDashboardConnection(clientId) {
  const ws = new WebSocket(WS_URL);
  const testSymbol = TEST_SYMBOLS[clientId % TEST_SYMBOLS.length];
  
  // Initialize metrics
  const metrics = {
    id: clientId,
    symbol: testSymbol,
    
    // Connection state
    status: 'connecting',
    connectedAt: null,
    uptime: 0,
    
    // Message counters
    messagesSent: 0,
    messagesReceived: 0,
    priceUpdatesReceived: 0,
    
    // Throughput tracking (messages per second)
    throughput: {
      sent: 0,
      received: 0,
      lastUpdate: Date.now(),
      lastSentCount: 0,
      lastReceivedCount: 0,
    },
    
    // Latency tracking
    latency: {
      current: 0,
      min: Infinity,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      samples: [],
    },
    
    // Real-time status
    lastMessageTime: null,
    timeSinceLastMessage: 0,
    isHealthy: false,
    healthStatus: '🔴',
    
    // Data quality
    dataQuality: {
      validMessages: 0,
      invalidMessages: 0,
      duplicates: 0,
      lastPrice: null,
    },
  };
  
  connectionMetrics.set(clientId, metrics);
  
  ws.on('open', () => {
    metrics.status = 'connected';
    metrics.connectedAt = Date.now();
    metrics.healthStatus = '🟡';
    
    // Subscribe to price
    sendWithLatencyTracking(ws, clientId, {
      type: 'subscribe_price',
      symbol: testSymbol,
    });
  });

  ws.on('message', (data) => {
    const receiveTime = Date.now();
    metrics.messagesReceived++;
    metrics.lastMessageTime = receiveTime;
    globalStats.totalMessagesReceived++;
    
    try {
      const message = JSON.parse(data);
      
      // Track latency for ping responses
      if (message._clientTimestamp) {
        const latency = receiveTime - message._clientTimestamp;
        trackLatency(metrics, latency);
      }
      
      switch (message.type) {
        case 'subscribed':
          metrics.status = 'subscribed';
          metrics.healthStatus = '🟢';
          break;
          
        case 'price_update':
          metrics.priceUpdatesReceived++;
          metrics.isHealthy = true;
          metrics.healthStatus = '🟢';
          
          // Track data quality
          if (message.data && message.data.price) {
            metrics.dataQuality.validMessages++;
            
            // Check for duplicate prices
            if (metrics.dataQuality.lastPrice === message.data.price) {
              metrics.dataQuality.duplicates++;
            }
            metrics.dataQuality.lastPrice = message.data.price;
          } else {
            metrics.dataQuality.invalidMessages++;
          }
          break;
          
        case 'error':
          metrics.healthStatus = '🔴';
          metrics.dataQuality.invalidMessages++;
          break;
      }
      
    } catch (e) {
      metrics.dataQuality.invalidMessages++;
    }
  });

  ws.on('error', () => {
    metrics.status = 'error';
    metrics.healthStatus = '🔴';
    metrics.isHealthy = false;
  });

  ws.on('close', () => {
    metrics.status = 'disconnected';
    metrics.healthStatus = '⚫';
    metrics.isHealthy = false;
  });
  
  // Periodic latency ping
  const latencyInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      sendWithLatencyTracking(ws, clientId, {
        type: 'subscribe_price',
        symbol: testSymbol,
      });
    } else {
      clearInterval(latencyInterval);
    }
  }, LATENCY_PING_INTERVAL);
  
  metrics.ws = ws;
  metrics.latencyInterval = latencyInterval;
}

function sendWithLatencyTracking(ws, clientId, message) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      message._clientTimestamp = Date.now();
      ws.send(JSON.stringify(message));
      
      const metrics = connectionMetrics.get(clientId);
      if (metrics) {
        metrics.messagesSent++;
        globalStats.totalMessagesSent++;
      }
    }
  } catch (error) {
    // Silent fail
  }
}

function trackLatency(metrics, latency) {
  const lat = metrics.latency;
  
  lat.current = latency;
  lat.min = Math.min(lat.min, latency);
  lat.max = Math.max(lat.max, latency);
  
  // Keep last 100 samples for percentile calculation
  lat.samples.push(latency);
  if (lat.samples.length > 100) {
    lat.samples.shift();
  }
  
  // Calculate average
  lat.avg = lat.samples.reduce((a, b) => a + b, 0) / lat.samples.length;
  
  // Calculate percentiles
  if (lat.samples.length > 10) {
    const sorted = [...lat.samples].sort((a, b) => a - b);
    lat.p50 = sorted[Math.floor(sorted.length * 0.50)];
    lat.p95 = sorted[Math.floor(sorted.length * 0.95)];
    lat.p99 = sorted[Math.floor(sorted.length * 0.99)];
  }
}

function updateThroughput() {
  const now = Date.now();
  
  connectionMetrics.forEach(metrics => {
    const elapsed = (now - metrics.throughput.lastUpdate) / 1000; // seconds
    
    if (elapsed > 0) {
      const sentDelta = metrics.messagesSent - metrics.throughput.lastSentCount;
      const receivedDelta = metrics.messagesReceived - metrics.throughput.lastReceivedCount;
      
      metrics.throughput.sent = (sentDelta / elapsed).toFixed(1);
      metrics.throughput.received = (receivedDelta / elapsed).toFixed(1);
      
      metrics.throughput.lastSentCount = metrics.messagesSent;
      metrics.throughput.lastReceivedCount = metrics.messagesReceived;
      metrics.throughput.lastUpdate = now;
    }
    
    // Update uptime
    if (metrics.connectedAt) {
      metrics.uptime = Math.floor((now - metrics.connectedAt) / 1000);
    }
    
    // Update time since last message
    if (metrics.lastMessageTime) {
      metrics.timeSinceLastMessage = Math.floor((now - metrics.lastMessageTime) / 1000);
      
      // Update health status based on message recency
      if (metrics.timeSinceLastMessage > 10 && metrics.status === 'subscribed') {
        metrics.healthStatus = '🟡'; // Stale
        metrics.isHealthy = false;
      }
    }
  });
}

// Real-time dashboard display
setInterval(() => {
  updateThroughput();
  
  // Clear console for dashboard effect
  console.clear();
  
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - globalStats.startTime) / 1000);
  
  console.log('━'.repeat(100));
  console.log('📊 WEBSOCKET REAL-TIME DASHBOARD'.padEnd(100));
  console.log('━'.repeat(100));
  console.log(`⏱️  Uptime: ${formatTime(uptimeSeconds)} | 🌐 Total Connections: ${connectionMetrics.size}`);
  console.log(`📤 Total Sent: ${globalStats.totalMessagesSent} | 📥 Total Received: ${globalStats.totalMessagesReceived}`);
  console.log('━'.repeat(100));
  
  // Calculate aggregate statistics
  const allMetrics = Array.from(connectionMetrics.values());
  const aggregateStats = calculateAggregateStats(allMetrics);
  
  console.log('\n📈 AGGREGATE STATISTICS:');
  console.log(`   Status: 🟢 ${aggregateStats.healthy} | 🟡 ${aggregateStats.stale} | 🔴 ${aggregateStats.error} | ⚫ ${aggregateStats.disconnected}`);
  console.log(`   Avg Latency: ${aggregateStats.avgLatency.toFixed(0)}ms (min: ${aggregateStats.minLatency.toFixed(0)}ms, max: ${aggregateStats.maxLatency.toFixed(0)}ms)`);
  console.log(`   P95 Latency: ${aggregateStats.p95Latency.toFixed(0)}ms | P99 Latency: ${aggregateStats.p99Latency.toFixed(0)}ms`);
  console.log(`   Avg Throughput: ⬆️  ${aggregateStats.avgSendRate}/s | ⬇️  ${aggregateStats.avgReceiveRate}/s`);
  console.log(`   Total Price Updates: ${aggregateStats.totalPriceUpdates}`);
  console.log(`   Data Quality: ✅ ${aggregateStats.validMessages} valid | ❌ ${aggregateStats.invalidMessages} invalid`);
  
  // Latency distribution histogram
  displayLatencyHistogram(allMetrics);
  
  console.log('\n━'.repeat(100));
  console.log('📋 PER-CONNECTION DETAILS (Top 15 by message count):');
  console.log('━'.repeat(100));
  console.log(' ID | Status | Symbol   | Uptime | Msgs Recv | Price Updates | Latency (avg) | Throughput ⬇️ | Health');
  console.log('━'.repeat(100));
  
  // Sort by messages received and show top 15
  const topConnections = allMetrics
    .sort((a, b) => b.messagesReceived - a.messagesReceived)
    .slice(0, 15);
  
  topConnections.forEach(m => {
    const id = String(m.id).padStart(3);
    const status = m.status.padEnd(12).substring(0, 12);
    const symbol = m.symbol.padEnd(8);
    const uptime = formatTime(m.uptime).padStart(6);
    const msgsRecv = String(m.messagesReceived).padStart(9);
    const priceUpd = String(m.priceUpdatesReceived).padStart(13);
    const latency = m.latency.avg > 0 ? `${m.latency.avg.toFixed(0)}ms`.padStart(13) : 'N/A'.padStart(13);
    const throughput = `${m.throughput.received}/s`.padStart(13);
    const health = m.healthStatus;
    
    console.log(`${id} | ${status} | ${symbol} | ${uptime} | ${msgsRecv} | ${priceUpd} | ${latency} | ${throughput} | ${health}`);
  });
  
  console.log('━'.repeat(100));
  
  // Show problematic connections if any
  const problematic = allMetrics.filter(m => 
    m.healthStatus === '🔴' || 
    m.dataQuality.invalidMessages > 0 ||
    m.timeSinceLastMessage > 15
  );
  
  if (problematic.length > 0) {
    console.log(`\n⚠️  PROBLEMATIC CONNECTIONS (${problematic.length}):`);
    problematic.slice(0, 5).forEach(m => {
      const issues = [];
      if (m.healthStatus === '🔴') issues.push('error');
      if (m.dataQuality.invalidMessages > 0) issues.push(`${m.dataQuality.invalidMessages} invalid msgs`);
      if (m.timeSinceLastMessage > 15) issues.push(`stale ${m.timeSinceLastMessage}s`);
      
      console.log(`   Client ${m.id}: ${issues.join(', ')}`);
    });
  }
  
  console.log('\n' + '━'.repeat(100));
  console.log('Press Ctrl+C to stop and view final summary');
  console.log('━'.repeat(100));
  
}, DASHBOARD_UPDATE_INTERVAL);

function calculateAggregateStats(metrics) {
  const stats = {
    healthy: 0,
    stale: 0,
    error: 0,
    disconnected: 0,
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    avgSendRate: 0,
    avgReceiveRate: 0,
    totalPriceUpdates: 0,
    validMessages: 0,
    invalidMessages: 0,
  };
  
  const latencySamples = [];
  let sendRateSum = 0;
  let receiveRateSum = 0;
  let latencySum = 0;
  let latencyCount = 0;
  
  metrics.forEach(m => {
    // Count by status
    if (m.healthStatus === '🟢') stats.healthy++;
    else if (m.healthStatus === '🟡') stats.stale++;
    else if (m.healthStatus === '🔴') stats.error++;
    else if (m.healthStatus === '⚫') stats.disconnected++;
    
    // Aggregate latency
    if (m.latency.avg > 0) {
      latencySum += m.latency.avg;
      latencyCount++;
      stats.minLatency = Math.min(stats.minLatency, m.latency.min);
      stats.maxLatency = Math.max(stats.maxLatency, m.latency.max);
      latencySamples.push(...m.latency.samples);
    }
    
    // Aggregate throughput
    sendRateSum += parseFloat(m.throughput.sent) || 0;
    receiveRateSum += parseFloat(m.throughput.received) || 0;
    
    // Aggregate counts
    stats.totalPriceUpdates += m.priceUpdatesReceived;
    stats.validMessages += m.dataQuality.validMessages;
    stats.invalidMessages += m.dataQuality.invalidMessages;
  });
  
  stats.avgLatency = latencyCount > 0 ? latencySum / latencyCount : 0;
  stats.avgSendRate = (sendRateSum / metrics.length).toFixed(1);
  stats.avgReceiveRate = (receiveRateSum / metrics.length).toFixed(1);
  
  // Calculate percentiles from all samples
  if (latencySamples.length > 10) {
    const sorted = latencySamples.sort((a, b) => a - b);
    stats.p95Latency = sorted[Math.floor(sorted.length * 0.95)] || 0;
    stats.p99Latency = sorted[Math.floor(sorted.length * 0.99)] || 0;
  }
  
  if (stats.minLatency === Infinity) stats.minLatency = 0;
  
  return stats;
}

function displayLatencyHistogram(metrics) {
  const latencySamples = [];
  metrics.forEach(m => latencySamples.push(...m.latency.samples));
  
  if (latencySamples.length === 0) return;
  
  // Create histogram buckets
  const buckets = {
    '0-50ms': 0,
    '50-100ms': 0,
    '100-200ms': 0,
    '200-500ms': 0,
    '500ms+': 0,
  };
  
  latencySamples.forEach(lat => {
    if (lat < 50) buckets['0-50ms']++;
    else if (lat < 100) buckets['50-100ms']++;
    else if (lat < 200) buckets['100-200ms']++;
    else if (lat < 500) buckets['200-500ms']++;
    else buckets['500ms+']++;
  });
  
  console.log('\n📊 LATENCY DISTRIBUTION:');
  const maxCount = Math.max(...Object.values(buckets));
  const barWidth = 40;
  
  Object.entries(buckets).forEach(([range, count]) => {
    const percentage = ((count / latencySamples.length) * 100).toFixed(1);
    const barLength = maxCount > 0 ? Math.floor((count / maxCount) * barWidth) : 0;
    const bar = '█'.repeat(barLength);
    console.log(`   ${range.padEnd(12)} ${bar.padEnd(barWidth)} ${count} (${percentage}%)`);
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Graceful shutdown with final summary
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down dashboard...\n');
  
  updateThroughput();
  const allMetrics = Array.from(connectionMetrics.values());
  const finalStats = calculateAggregateStats(allMetrics);
  
  console.log('━'.repeat(100));
  console.log('📋 FINAL SUMMARY REPORT');
  console.log('━'.repeat(100));
  
  const uptimeSeconds = Math.floor((Date.now() - globalStats.startTime) / 1000);
  console.log(`\n⏱️  Total Test Duration: ${formatTime(uptimeSeconds)}`);
  console.log(`🌐 Total Connections: ${connectionMetrics.size}`);
  console.log(`   🟢 Healthy: ${finalStats.healthy} | 🟡 Stale: ${finalStats.stale} | 🔴 Error: ${finalStats.error} | ⚫ Disconnected: ${finalStats.disconnected}`);
  
  console.log(`\n📨 Message Statistics:`);
  console.log(`   Total Sent: ${globalStats.totalMessagesSent}`);
  console.log(`   Total Received: ${globalStats.totalMessagesReceived}`);
  console.log(`   Price Updates: ${finalStats.totalPriceUpdates}`);
  console.log(`   Valid Messages: ${finalStats.validMessages}`);
  console.log(`   Invalid Messages: ${finalStats.invalidMessages}`);
  
  console.log(`\n⚡ Performance Metrics:`);
  console.log(`   Avg Latency: ${finalStats.avgLatency.toFixed(0)}ms`);
  console.log(`   Min Latency: ${finalStats.minLatency.toFixed(0)}ms`);
  console.log(`   Max Latency: ${finalStats.maxLatency.toFixed(0)}ms`);
  console.log(`   P95 Latency: ${finalStats.p95Latency.toFixed(0)}ms`);
  console.log(`   P99 Latency: ${finalStats.p99Latency.toFixed(0)}ms`);
  
  const successRate = connectionMetrics.size > 0 
    ? ((finalStats.healthy / connectionMetrics.size) * 100).toFixed(1)
    : 0;
  console.log(`\n🎯 Connection Success Rate: ${successRate}%`);
  
  console.log('\n' + '━'.repeat(100));
  
  process.exit(0);
});
