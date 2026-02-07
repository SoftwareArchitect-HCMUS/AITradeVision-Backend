import WebSocket from 'ws';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

const BINANCE_WS_URL = 'wss://fstream.binance.com/stream?streams=btcusdt@kline_1m';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_CHANNEL = 'price.btcusdt';
const TEST_DURATION_MS = 30000;

interface PriceData {
    source: 'BINANCE' | 'REDIS';
    price: number;
    timestamp: number;
    arrivalTimestamp: number;
}

const collectedData: PriceData[] = [];
let binanceWs: WebSocket;
let redisSub: Redis;

function startTest() {
    console.log('Starting Redis latency test...');
    console.log(`Duration: ${TEST_DURATION_MS / 1000} seconds`);

    // Connect to Binance
    binanceWs = new WebSocket(BINANCE_WS_URL);
    binanceWs.on('open', () => console.log('Connected to Binance WebSocket'));
    binanceWs.on('message', (data: Buffer) => {
        const arrivalTimestamp = Date.now();
        try {
            const parsed = JSON.parse(data.toString());
            if (parsed.data && parsed.data.k) {
                const kline = parsed.data.k;
                collectedData.push({
                    source: 'BINANCE',
                    price: parseFloat(kline.c),
                    timestamp: kline.T,
                    arrivalTimestamp
                });
            }
        } catch (e) {}
    });

    // Connect to Redis
    redisSub = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT
    });

    redisSub.subscribe(REDIS_CHANNEL, (err) => {
        if (err) console.error('Failed to subscribe to Redis:', err);
        else console.log(`Subscribed to Redis channel: ${REDIS_CHANNEL}`);
    });

    redisSub.on('message', (channel, message) => {
        const arrivalTimestamp = Date.now();
        if (channel === REDIS_CHANNEL) {
            try {
                const parsed = JSON.parse(message);
                collectedData.push({
                    source: 'REDIS',
                    price: parsed.price,
                    timestamp: parsed.timestamp,
                    arrivalTimestamp
                });
            } catch (e) {}
        }
    });

    setTimeout(finishTest, TEST_DURATION_MS);
}

function finishTest() {
    console.log('Test finished. Closing connections...');
    binanceWs.close();
    redisSub.disconnect();
    analyzeData();
}

function analyzeData() {
    console.log('Analyzing data...');
    
    const binanceData = collectedData.filter(d => d.source === 'BINANCE').sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);
    const redisData = collectedData.filter(d => d.source === 'REDIS').sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);

    console.log(`Collected ${binanceData.length} Binance updates and ${redisData.length} Redis updates.`);

    let totalLatency = 0;
    let matchedCount = 0;
    let maxLatency = 0;

    const matches = [];

    for (const redisMsg of redisData) {
        // Find matching Binance message (same price/timestamp received earlier)
        const match = binanceData.find(b => Math.abs(b.timestamp - redisMsg.timestamp) < 100);

        if (match) {
            const latency = redisMsg.arrivalTimestamp - match.arrivalTimestamp;
            matches.push({
                timestamp: new Date(redisMsg.arrivalTimestamp).toISOString().split('T')[1].replace('Z', ''),
                latency
            });
            totalLatency += latency;
            if (latency > maxLatency) maxLatency = latency;
            matchedCount++;
        }
    }

    const avgLatency = matchedCount > 0 ? totalLatency / matchedCount : 0;

    const report = `
# Redis Latency Report

**Date:** ${new Date().toISOString()}
**Metric:** Latency vs. Binance Direct
**Matched Points:** ${matchedCount}

## Results
- **Avg Latency:** ${avgLatency.toFixed(2)} ms
- **Max Latency:** ${maxLatency} ms

## Diagnosis
${avgLatency > 1000 ? "🔴 **CRITICAL:** High latency in Price Collector -> Redis path." : "🟢 **GOOD:** Low latency in Price Collector. Issue is likely downstream (Web Server)."}

## Samples
| Time | Latency (ms) |
|------|--------------|
${matches.slice(0, 10).map(m => `| ${m.timestamp} | ${m.latency} |`).join('\n')}
    `;

    fs.writeFileSync(path.join(__dirname, 'redis_latency_report.md'), report.trim());
    console.log('Report generated: redis_latency_report.md');
}

startTest();
