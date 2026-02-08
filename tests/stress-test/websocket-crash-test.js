const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3000/ws';
const TOTAL_CONNECTIONS = 1000; // Target connections
const CONNECTION_RAMP_DELAY = 500; // 10ms between connections (100 conn/sec ramp)
const MESSAGE_BURST_SIZE = 1; // Reduced for stability  
const MESSAGE_INTERVAL = 200000000; // Increased interval for better handling

let connectedClients = 0;
let totalMessages = 0;
let totalMessagesReceived = 0; // Track messages received from server
let totalErrors = 0;
let crashDetected = false;

// Crypto symbols to test with
const TEST_SYMBOLS = ['btcusdt', 'ethusdt', 'adausdt', 'bnbusdt', 'solusdt', 'dotusdt', 'linkusdt', 'xrpusdt'];

console.log(`🚀 AGGRESSIVE STRESS TEST - ${TOTAL_CONNECTIONS} connections`);
console.log(`💥 Target: Crash server with limited resources (256MB RAM, 0.5 CPU)`);
console.log(`📊 Stats will be printed every 5 seconds`);

// Create multiple WebSocket connections with gradual ramping
console.log(`⏰ Connection ramp: ${CONNECTION_RAMP_DELAY}ms delay (${1000/CONNECTION_RAMP_DELAY} conn/sec)`);
for (let i = 0; i < TOTAL_CONNECTIONS; i++) {
  setTimeout(() => {
    if (!crashDetected) {
      createWebSocketConnection(i);
    }
  }, CONNECTION_RAMP_DELAY); // Use configurable connection delay
}

function createWebSocketConnection(clientId) {
  try {
    const ws = new WebSocket(WS_URL);
    const testSymbol = TEST_SYMBOLS[clientId % TEST_SYMBOLS.length];
    
    ws.on('open', () => {
      connectedClients++;
      console.log(`⚡ Client ${clientId} connected (${connectedClients}/${TOTAL_CONNECTIONS})`);
      
      // Immediately subscribe
      sendMessage(ws, {
        type: 'subscribe_price',
        symbol: testSymbol
      });
      
      // Start aggressive message sending
      let messageCount = 0;
      const aggressiveInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && !crashDetected) {
          // Send multiple messages in rapid succession
          for (let burst = 0; burst < MESSAGE_BURST_SIZE; burst++) {
            const action = messageCount % 2 === 0 ? 'subscribe_price' : 'unsubscribe_price';
            const randomSymbol = TEST_SYMBOLS[Math.floor(Math.random() * TEST_SYMBOLS.length)];
            
            sendMessage(ws, {
              type: action,
              symbol: randomSymbol,
              timestamp: Date.now(),
              clientId: clientId,
              messageCount: messageCount++,
              // Add large payload to increase memory pressure (1KB per message)
              //memoryPressureData: 'X'.repeat(1024)
            });
          }
        } else {
          clearInterval(aggressiveInterval);
        }
      }, MESSAGE_INTERVAL);
    });

    ws.on('message', (data) => {
      totalMessagesReceived++; // Count all messages received from server
      
      try {
        const message = JSON.parse(data);
        
        // Log messages in single line for easier debugging
        switch (message.type) {
          case 'subscribed':
            console.log(`📨 Client ${clientId}: ✅ subscribed ${message.symbol}`);
            break;
          case 'unsubscribed': 
            console.log(`📨 Client ${clientId}: ❌ unsubscribed ${message.symbol}`);
            break;
          case 'price_update':
            if (message.data) {
              console.log(`📨 Client ${clientId}: 💰 ${message.data.symbol} $${message.data.price}`);
            }
            break;
          case 'error':
            console.log(`📨 Client ${clientId}: 🚨 ERROR ${message.message}`);
            break;
          default:
            console.log(`📨 Client ${clientId}: ❓ ${message.type} ${JSON.stringify(message)}`);
        }
        
      } catch (e) {
        console.log(`📨 Client ${clientId}: RAW ${data.toString()}`);
      }
    });

    ws.on('error', (error) => {
      totalErrors++;
      console.log(`❌ Client ${clientId} connection error: ${error.message}`);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        if (!crashDetected) {
          crashDetected = true;
          console.log(`\n💥 CRASH DETECTED! Server stopped responding after:`);
          console.log(`   - ${connectedClients} connected clients`);
          console.log(`   - ${totalMessages} total messages sent`);
          console.log(`   - ${totalErrors} total errors`);
          console.log(`   - Error: ${error.message}`);
        }
      }
    });

    ws.on('close', (code, reason) => {
      connectedClients--;
      if (code !== 1000 && code !== 1001) { // Not normal or going away
        console.log(`🔌 Client ${clientId} unexpected disconnect: ${code} - ${reason}`);
      }
    });

  } catch (error) {
    totalErrors++;
    console.log(`⚠️  Failed to create client ${clientId}: ${error.message}`);
  }
}

function sendMessage(ws, message) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      totalMessages++;
    }
  } catch (error) {
    totalErrors++;
  }
}

// Print statistics every 5 seconds
const statsInterval = setInterval(() => {
  console.log('\n📈 === STRESS TEST STATISTICS ===');
  console.log(`🔗 Connected clients: ${connectedClients}/${TOTAL_CONNECTIONS}`);
  console.log(`📤 Messages sent to server: ${totalMessages}`);
  console.log(`📥 Messages received from server: ${totalMessagesReceived}`);
  console.log(`❌ Total errors: ${totalErrors}`);
  console.log(`📊 Send rate: ${(totalMessages / ((Date.now() - startTime) / 1000)).toFixed(0)} msg/sec`);
  console.log(`📊 Receive rate: ${(totalMessagesReceived / ((Date.now() - startTime) / 1000)).toFixed(0)} msg/sec`);
  console.log('================================\n');
  
  if (crashDetected) {
    clearInterval(statsInterval);
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  }
}, 5000);

const startTime = Date.now();

// Monitor for crash detection
setTimeout(() => {
  if (!crashDetected && connectedClients === 0) {
    console.log('\n🎯 Test completed - all connections failed to establish');
    console.log('This might indicate server crashed during startup');
    process.exit(0);
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping stress test...');
  console.log(`Final stats: ${connectedClients} connected, ${totalMessages} sent, ${totalMessagesReceived} received, ${totalErrors} errors`);
  process.exit(0);
});