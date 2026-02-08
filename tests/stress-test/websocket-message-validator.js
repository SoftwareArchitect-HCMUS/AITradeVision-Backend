const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3000/ws';
const TOTAL_CONNECTIONS = 1000;
const CONNECTION_RAMP_DELAY = 150;
const VALIDATION_REPORT_INTERVAL = 8000;

const TEST_SYMBOLS = ['btcusdt', 'ethusdt'];

// Track message sequences and validation for each connection
const connectionValidation = new Map();

console.log(`🔍 WebSocket Message Validator - ${TOTAL_CONNECTIONS} connections`);
console.log(`📋 Validating: Message sequence, symbol correctness, data integrity\n`);

for (let i = 0; i < TOTAL_CONNECTIONS; i++) {
  setTimeout(() => createValidatedConnection(i), i * CONNECTION_RAMP_DELAY);
}

function createValidatedConnection(clientId) {
  const ws = new WebSocket(WS_URL);
  const testSymbol = TEST_SYMBOLS[clientId % TEST_SYMBOLS.length];
  
  // Initialize validation tracking
  const validation = {
    id: clientId,
    symbol: testSymbol,
    expectedSymbol: testSymbol.toUpperCase(),
    
    // Message tracking
    messagesReceived: 0,
    priceUpdates: 0,
    subscriptionConfirms: 0,
    unsubscriptionConfirms: 0,
    errors: 0,
    
    // Validation results
    correctSymbolUpdates: 0,
    wrongSymbolUpdates: 0,
    invalidMessages: 0,
    missingFields: 0,
    
    // Price tracking for sequence validation
    lastPrice: null,
    priceHistory: [],
    duplicatePrices: 0,
    
    // Timing
    subscribeTime: null,
    firstPriceTime: null,
    lastMessageTime: null,
    
    // State
    isSubscribed: false,
    connectionStatus: 'connecting',
    
    // Expected messages
    expectedSubscriptionConfirm: false,
  };
  
  connectionValidation.set(clientId, validation);
  
  ws.on('open', () => {
    validation.connectionStatus = 'connected';
    validation.subscribeTime = Date.now();
    validation.expectedSubscriptionConfirm = true;
    
    console.log(`🔗 Client ${clientId}: Connected, subscribing to ${testSymbol}`);
    
    ws.send(JSON.stringify({
      type: 'subscribe_price',
      symbol: testSymbol,
      clientId: clientId
    }));
  });

  ws.on('message', (data) => {
    validation.messagesReceived++;
    validation.lastMessageTime = Date.now();
    
    try {
      const message = JSON.parse(data);
      
      // Validate message structure
      if (!message.type) {
        validation.invalidMessages++;
        console.log(`❌ Client ${clientId}: Invalid message - missing 'type' field`);
        return;
      }
      
      switch (message.type) {
        case 'subscribed':
          handleSubscriptionConfirm(clientId, message, validation);
          break;
          
        case 'unsubscribed':
          validation.unsubscriptionConfirms++;
          console.log(`📤 Client ${clientId}: Unsubscription confirmed for ${message.symbol}`);
          break;
          
        case 'price_update':
          handlePriceUpdate(clientId, message, validation);
          break;
          
        case 'error':
          validation.errors++;
          console.log(`❌ Client ${clientId}: Error received - ${message.message}`);
          break;
          
        default:
          validation.invalidMessages++;
          console.log(`⚠️  Client ${clientId}: Unknown message type '${message.type}'`);
      }
      
    } catch (e) {
      validation.invalidMessages++;
      console.log(`❌ Client ${clientId}: Failed to parse message - ${e.message}`);
    }
  });

  ws.on('error', (error) => {
    validation.connectionStatus = 'error';
    validation.errors++;
    console.log(`❌ Client ${clientId}: Connection error - ${error.message}`);
  });

  ws.on('close', () => {
    validation.connectionStatus = 'disconnected';
    console.log(`🔌 Client ${clientId}: Connection closed`);
  });
}

function handleSubscriptionConfirm(clientId, message, validation) {
  validation.subscriptionConfirms++;
  
  // Validate subscription confirmation
  if (!validation.expectedSubscriptionConfirm) {
    console.log(`⚠️  Client ${clientId}: Unexpected subscription confirm for ${message.symbol}`);
    validation.invalidMessages++;
    return;
  }
  
  // Validate symbol in confirmation
  if (!message.symbol) {
    console.log(`❌ Client ${clientId}: Subscription confirm missing 'symbol' field`);
    validation.missingFields++;
    return;
  }
  
  if (message.symbol.toLowerCase() !== validation.symbol) {
    console.log(`❌ Client ${clientId}: Wrong symbol in confirm! Expected ${validation.symbol}, got ${message.symbol}`);
    validation.wrongSymbolUpdates++;
    return;
  }
  
  validation.isSubscribed = true;
  validation.expectedSubscriptionConfirm = false;
  
  const latency = Date.now() - validation.subscribeTime;
  console.log(`✅ Client ${clientId}: Subscription confirmed for ${message.symbol} (${latency}ms)`);
}

function handlePriceUpdate(clientId, message, validation) {
  validation.priceUpdates++;
  
  // Record first price update time
  if (!validation.firstPriceTime) {
    validation.firstPriceTime = Date.now();
    const timeToFirstPrice = validation.firstPriceTime - validation.subscribeTime;
    console.log(`💰 Client ${clientId}: First price update received (${timeToFirstPrice}ms after subscribe)`);
  }
  
  // Validate data field exists
  if (!message.data) {
    console.log(`❌ Client ${clientId}: Price update missing 'data' field`);
    validation.missingFields++;
    return;
  }
  
  const { symbol, price, timestamp } = message.data;
  
  // Validate required fields
  if (!symbol || price === undefined) {
    console.log(`❌ Client ${clientId}: Price update missing required fields (symbol or price)`);
    validation.missingFields++;
    return;
  }
  
  // Validate correct symbol
  if (symbol !== validation.expectedSymbol) {
    console.log(`❌ Client ${clientId}: WRONG SYMBOL! Expected ${validation.expectedSymbol}, got ${symbol}`);
    validation.wrongSymbolUpdates++;
    return;
  }
  
  validation.correctSymbolUpdates++;
  
  // Validate price is a valid number
  const priceNum = parseFloat(price);
  if (isNaN(priceNum) || priceNum <= 0) {
    console.log(`❌ Client ${clientId}: Invalid price value: ${price}`);
    validation.invalidMessages++;
    return;
  }
  
  // Check for duplicate prices (might indicate stale data)
  if (validation.lastPrice === priceNum) {
    validation.duplicatePrices++;
  }
  
  // Track price history (keep last 10)
  validation.priceHistory.push({
    price: priceNum,
    timestamp: timestamp || Date.now(),
    receivedAt: Date.now()
  });
  
  if (validation.priceHistory.length > 10) {
    validation.priceHistory.shift();
  }
  
  validation.lastPrice = priceNum;
  
  // Log successful price update (periodically to avoid spam)
  if (validation.priceUpdates % 10 === 1) {
    console.log(`✅ Client ${clientId}: ${symbol} = $${price} (${validation.priceUpdates} total updates)`);
  }
}

// Validation report
setInterval(() => {
  console.log(`\n🔍 === MESSAGE VALIDATION REPORT ===`);
  
  const allValidations = Array.from(connectionValidation.values());
  
  const stats = {
    totalConnections: allValidations.length,
    connected: 0,
    subscribed: 0,
    receivingPrices: 0,
    
    totalMessages: 0,
    totalPriceUpdates: 0,
    correctSymbols: 0,
    wrongSymbols: 0,
    invalidMessages: 0,
    missingFields: 0,
    errors: 0,
    
    avgPriceUpdatesPerConn: 0,
    validationSuccessRate: 0,
  };
  
  allValidations.forEach(v => {
    if (v.connectionStatus === 'connected') stats.connected++;
    if (v.isSubscribed) stats.subscribed++;
    if (v.priceUpdates > 0) stats.receivingPrices++;
    
    stats.totalMessages += v.messagesReceived;
    stats.totalPriceUpdates += v.priceUpdates;
    stats.correctSymbols += v.correctSymbolUpdates;
    stats.wrongSymbols += v.wrongSymbolUpdates;
    stats.invalidMessages += v.invalidMessages;
    stats.missingFields += v.missingFields;
    stats.errors += v.errors;
  });
  
  stats.avgPriceUpdatesPerConn = (stats.totalPriceUpdates / stats.totalConnections).toFixed(1);
  
  // Calculate validation success rate
  const totalValidatable = stats.totalPriceUpdates;
  const totalValid = stats.correctSymbols;
  stats.validationSuccessRate = totalValidatable > 0 
    ? ((totalValid / totalValidatable) * 100).toFixed(2)
    : 0;
  
  console.log(`📊 Connection Status:`);
  console.log(`   Total: ${stats.totalConnections} | Connected: ${stats.connected} | Subscribed: ${stats.subscribed} | Receiving: ${stats.receivingPrices}`);
  
  console.log(`\n📨 Message Statistics:`);
  console.log(`   Total Messages: ${stats.totalMessages}`);
  console.log(`   Price Updates: ${stats.totalPriceUpdates}`);
  console.log(`   Avg Updates/Connection: ${stats.avgPriceUpdatesPerConn}`);
  
  console.log(`\n✅ Validation Results:`);
  console.log(`   Correct Symbol Updates: ${stats.correctSymbols}`);
  console.log(`   Wrong Symbol Updates: ${stats.wrongSymbols}`);
  console.log(`   Invalid Messages: ${stats.invalidMessages}`);
  console.log(`   Missing Fields: ${stats.missingFields}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   SUCCESS RATE: ${stats.validationSuccessRate}%`);
  
  // Show connections with issues
  const problematic = allValidations.filter(v => 
    v.wrongSymbolUpdates > 0 || 
    v.invalidMessages > 0 || 
    v.missingFields > 0 ||
    (v.isSubscribed && v.priceUpdates === 0)
  );
  
  if (problematic.length > 0) {
    console.log(`\n⚠️  Connections with Issues (${problematic.length}):`);
    problematic.slice(0, 5).forEach(v => {
      const issues = [];
      if (v.wrongSymbolUpdates > 0) issues.push(`${v.wrongSymbolUpdates} wrong symbols`);
      if (v.invalidMessages > 0) issues.push(`${v.invalidMessages} invalid msgs`);
      if (v.missingFields > 0) issues.push(`${v.missingFields} missing fields`);
      if (v.isSubscribed && v.priceUpdates === 0) issues.push(`no price updates`);
      
      console.log(`   Client ${v.id} (${v.symbol}): ${issues.join(', ')}`);
    });
  }
  
  // Show best performing connections
  const topPerformers = allValidations
    .filter(v => v.connectionStatus === 'connected' && v.priceUpdates > 0)
    .sort((a, b) => b.correctSymbolUpdates - a.correctSymbolUpdates)
    .slice(0, 5);
  
  if (topPerformers.length > 0) {
    console.log(`\n🏆 Top Validated Connections:`);
    topPerformers.forEach((v, idx) => {
      const accuracy = v.priceUpdates > 0 
        ? ((v.correctSymbolUpdates / v.priceUpdates) * 100).toFixed(1)
        : 0;
      console.log(`   ${idx + 1}. Client ${v.id}: ${v.correctSymbolUpdates} valid updates, ${accuracy}% accuracy`);
    });
  }
  
  console.log(`================================\n`);
  
}, VALIDATION_REPORT_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down validator...\n');
  
  console.log('📋 === FINAL VALIDATION SUMMARY ===');
  
  const allValidations = Array.from(connectionValidation.values());
  const perfectConnections = allValidations.filter(v => 
    v.priceUpdates > 0 && 
    v.wrongSymbolUpdates === 0 && 
    v.invalidMessages === 0 && 
    v.missingFields === 0
  ).length;
  
  const totalCorrect = allValidations.reduce((sum, v) => sum + v.correctSymbolUpdates, 0);
  const totalWrong = allValidations.reduce((sum, v) => sum + v.wrongSymbolUpdates, 0);
  const totalInvalid = allValidations.reduce((sum, v) => sum + v.invalidMessages, 0);
  
  console.log(`Perfect Connections: ${perfectConnections}/${allValidations.length} (${(perfectConnections/allValidations.length*100).toFixed(1)}%)`);
  console.log(`Total Correct Messages: ${totalCorrect}`);
  console.log(`Total Wrong Symbols: ${totalWrong}`);
  console.log(`Total Invalid Messages: ${totalInvalid}`);
  
  const overallAccuracy = totalCorrect + totalWrong > 0
    ? ((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(2)
    : 0;
  console.log(`\n🎯 Overall Accuracy: ${overallAccuracy}%`);
  
  process.exit(0);
});
