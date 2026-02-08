const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3000/ws';
const TOTAL_CONNECTIONS = 50; // Moderate for detailed monitoring
const CONNECTION_RAMP_DELAY = 100;
const HEARTBEAT_INTERVAL = 5000; // Check health every 5s
const EXPECTED_MESSAGE_INTERVAL = 2000; // Expect message within 2s

// Track each connection's health
const connectionHealth = new Map();

const TEST_SYMBOLS = ['btcusdt', 'ethusdt', 'adausdt', 'bnbusdt', 'solusdt'];

console.log(`🏥 WebSocket Health Monitor - ${TOTAL_CONNECTIONS} connections`);
console.log(`📊 Monitoring: Connection stability, latency, message frequency\n`);

// Create connections with health tracking
for (let i = 0; i < TOTAL_CONNECTIONS; i++) {
  setTimeout(() => createHealthMonitoredConnection(i), i * CONNECTION_RAMP_DELAY);
}

function createHealthMonitoredConnection(clientId) {
  const ws = new WebSocket(WS_URL);
  const testSymbol = TEST_SYMBOLS[clientId % TEST_SYMBOLS.length];
  
  // Initialize health metrics
  const health = {
    id: clientId,
    symbol: testSymbol,
    status: 'connecting',
    connected: false,
    lastMessageTime: null,
    messageCount: 0,
    sentCount: 0,
    errorCount: 0,
    avgLatency: 0,
    latencies: [],
    subscribed: false,
    lastHeartbeat: Date.now(),
    consecutiveTimeouts: 0
  };
  
  connectionHealth.set(clientId, health);
  
  ws.on('open', () => {
    health.connected = true;
    health.status = 'connected';
    health.lastHeartbeat = Date.now();
    
    console.log(`✅ Client ${clientId} connected - subscribing to ${testSymbol}`);
    
    // Subscribe to symbol
    const subscribeTime = Date.now();
    sendTrackedMessage(ws, clientId, {
      type: 'subscribe_price',
      symbol: testSymbol,
      _timestamp: subscribeTime
    });
  });

  ws.on('message', (data) => {
    const receiveTime = Date.now();
    health.lastMessageTime = receiveTime;
    health.messageCount++;
    health.lastHeartbeat = receiveTime;
    health.consecutiveTimeouts = 0; // Reset timeout counter
    
    try {
      const message = JSON.parse(data);
      
      // Calculate latency for subscribe/unsubscribe confirmations
      if (message._timestamp) {
        const latency = receiveTime - message._timestamp;
        health.latencies.push(latency);
        if (health.latencies.length > 10) health.latencies.shift();
        health.avgLatency = health.latencies.reduce((a, b) => a + b, 0) / health.latencies.length;
      }
      
      switch (message.type) {
        case 'subscribed':
          health.subscribed = true;
          health.status = 'active';
          console.log(`✅ Client ${clientId}: Subscribed to ${message.symbol} (latency: ${health.avgLatency.toFixed(0)}ms)`);
          break;
          
        case 'price_update':
          // Validate correct symbol
          if (message.data && message.data.symbol === testSymbol.toUpperCase()) {
            health.status = 'receiving_data';
          } else if (message.data) {
            console.log(`⚠️  Client ${clientId}: Wrong symbol! Expected ${testSymbol}, got ${message.data.symbol}`);
            health.errorCount++;
          }
          break;
          
        case 'error':
          health.errorCount++;
          health.status = 'error';
          console.log(`❌ Client ${clientId}: Error - ${message.message}`);
          break;
      }
      
    } catch (e) {
      health.errorCount++;
      console.log(`⚠️  Client ${clientId}: Parse error`);
    }
  });

  ws.on('error', (error) => {
    health.errorCount++;
    health.status = 'error';
    health.connected = false;
    console.log(`❌ Client ${clientId}: Connection error - ${error.message}`);
  });

  ws.on('close', () => {
    health.connected = false;
    health.status = 'disconnected';
    console.log(`🔌 Client ${clientId}: Disconnected`);
  });
  
  // Store ws reference for heartbeat
  health.ws = ws;
}

function sendTrackedMessage(ws, clientId, message) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      const health = connectionHealth.get(clientId);
      if (health) health.sentCount++;
    }
  } catch (error) {
    const health = connectionHealth.get(clientId);
    if (health) health.errorCount++;
  }
}

// Heartbeat checker - detect stale connections
setInterval(() => {
  const now = Date.now();
  let healthyCount = 0;
  let staleCount = 0;
  let errorCount = 0;
  
  connectionHealth.forEach((health, clientId) => {
    if (!health.connected) {
      errorCount++;
      return;
    }
    
    const timeSinceMessage = now - (health.lastMessageTime || now);
    
    // Check if connection is stale (no message in expected interval)
    if (health.subscribed && timeSinceMessage > EXPECTED_MESSAGE_INTERVAL) {
      health.consecutiveTimeouts++;
      staleCount++;
      if (health.consecutiveTimeouts >= 3) {
        console.log(`⚠️  Client ${clientId}: STALE! No message for ${(timeSinceMessage/1000).toFixed(1)}s`);
      }
    } else if (health.status === 'receiving_data') {
      healthyCount++;
    }
  });
  
  console.log(`\n💓 === HEALTH CHECK ===`);
  console.log(`🟢 Healthy: ${healthyCount} (receiving data regularly)`);
  console.log(`🟡 Stale: ${staleCount} (no recent messages)`);
  console.log(`🔴 Error/Disconnected: ${errorCount}`);
  
}, HEARTBEAT_INTERVAL);

// Detailed statistics every 10 seconds
setInterval(() => {
  console.log(`\n📊 === DETAILED CONNECTION STATS ===`);
  
  const stats = {
    total: 0,
    connected: 0,
    subscribed: 0,
    receivingData: 0,
    avgMessagesPerConn: 0,
    avgLatency: 0,
    totalErrors: 0
  };
  
  let totalMessages = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  
  connectionHealth.forEach((health) => {
    stats.total++;
    if (health.connected) stats.connected++;
    if (health.subscribed) stats.subscribed++;
    if (health.status === 'receiving_data') stats.receivingData++;
    
    totalMessages += health.messageCount;
    stats.totalErrors += health.errorCount;
    
    if (health.avgLatency > 0) {
      totalLatency += health.avgLatency;
      latencyCount++;
    }
  });
  
  stats.avgMessagesPerConn = (totalMessages / stats.total).toFixed(1);
  stats.avgLatency = latencyCount > 0 ? (totalLatency / latencyCount).toFixed(0) : 0;
  
  console.log(`Total Connections: ${stats.total}`);
  console.log(`Connected: ${stats.connected} (${(stats.connected/stats.total*100).toFixed(0)}%)`);
  console.log(`Subscribed: ${stats.subscribed} (${(stats.subscribed/stats.total*100).toFixed(0)}%)`);
  console.log(`Actively Receiving: ${stats.receivingData} (${(stats.receivingData/stats.total*100).toFixed(0)}%)`);
  console.log(`Avg Messages/Connection: ${stats.avgMessagesPerConn}`);
  console.log(`Avg Latency: ${stats.avgLatency}ms`);
  console.log(`Total Errors: ${stats.totalErrors}`);
  console.log(`================================\n`);
  
  // Show top 5 healthiest connections
  const sortedHealthy = Array.from(connectionHealth.values())
    .filter(h => h.status === 'receiving_data')
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);
    
  if (sortedHealthy.length > 0) {
    console.log(`🏆 Top 5 Healthiest Connections:`);
    sortedHealthy.forEach((h, idx) => {
      console.log(`   ${idx + 1}. Client ${h.id}: ${h.messageCount} msgs, ${h.avgLatency.toFixed(0)}ms latency, ${h.symbol}`);
    });
    console.log('');
  }
  
  // Show problematic connections
  const problematic = Array.from(connectionHealth.values())
    .filter(h => h.errorCount > 0 || h.consecutiveTimeouts >= 2)
    .slice(0, 5);
    
  if (problematic.length > 0) {
    console.log(`⚠️  Problematic Connections:`);
    problematic.forEach((h) => {
      console.log(`   Client ${h.id}: ${h.errorCount} errors, ${h.consecutiveTimeouts} timeouts, status: ${h.status}`);
    });
    console.log('');
  }
  
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down health monitor...');
  
  // Print final summary
  console.log('\n📋 === FINAL HEALTH REPORT ===');
  const finalStats = Array.from(connectionHealth.values());
  const healthy = finalStats.filter(h => h.status === 'receiving_data').length;
  const errors = finalStats.filter(h => h.errorCount > 0).length;
  
  console.log(`✅ Healthy connections: ${healthy}/${finalStats.length}`);
  console.log(`❌ Connections with errors: ${errors}/${finalStats.length}`);
  console.log(`📊 Success rate: ${(healthy/finalStats.length*100).toFixed(1)}%`);
  
  process.exit(0);
});
