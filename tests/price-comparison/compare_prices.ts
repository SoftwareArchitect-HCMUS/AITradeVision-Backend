import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const BINANCE_WS_URL = 'wss://fstream.binance.com/stream?streams=btcusdt@kline_1m';
const LOCAL_WS_URL = 'ws://localhost:3000/ws';
const TEST_DURATION_MS = 30000;
const SYMBOL = 'BTCUSDT';

interface PriceData {
    source: 'BINANCE' | 'LOCAL';
    price: number;
    timestamp: number;
    arrivalTimestamp: number;
}

const collectedData: PriceData[] = [];
let binanceWs: WebSocket;
let localWs: WebSocket;

function startTest() {
    console.log('Starting price comparison test...');
    console.log(`Duration: ${TEST_DURATION_MS / 1000} seconds`);

    binanceWs = new WebSocket(BINANCE_WS_URL);
    localWs = new WebSocket(LOCAL_WS_URL);

    binanceWs.on('open', () => {
        console.log('Connected to Binance WebSocket');
    });

    binanceWs.on('message', (data: Buffer) => {
        const arrivalTimestamp = Date.now();
        try {
            const parsed = JSON.parse(data.toString());
            if (parsed.data && parsed.data.k) {
                const kline = parsed.data.k;
                const price = parseFloat(kline.c);
                const timestamp = kline.T; // Close time
                
                collectedData.push({
                    source: 'BINANCE',
                    price,
                    timestamp,
                    arrivalTimestamp
                });
            }
        } catch (e) {
            // ignore
        }
    });

    localWs.on('open', () => {
        console.log('Connected to Local WebSocket');
        localWs.send(JSON.stringify({
            type: 'subscribe_price',
            symbol: SYMBOL
        }));
    });

    localWs.on('message', (data: Buffer) => {
        const arrivalTimestamp = Date.now();
        try {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'price_update' && parsed.data) {
                const price = parsed.data.price;
                const timestamp = parsed.data.timestamp;

                collectedData.push({
                    source: 'LOCAL',
                    price,
                    timestamp,
                    arrivalTimestamp
                });
            }
        } catch (e) {
            // ignore
        }
    });

    setTimeout(() => {
        finishTest();
    }, TEST_DURATION_MS);
}

function finishTest() {
    console.log('Test finished. Closing connections...');
    binanceWs.close();
    localWs.close();

    analyzeData();
}

function analyzeData() {
    console.log('Analyzing data...');
    
    const binanceData = collectedData.filter(d => d.source === 'BINANCE').sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);
    const localData = collectedData.filter(d => d.source === 'LOCAL').sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);

    console.log(`Collected ${binanceData.length} Binance updates and ${localData.length} Local updates.`);

    let totalLatency = 0;
    let matchedCount = 0;
    let maxLatency = 0;
    let minLatency = Infinity;
    
    let totalPriceDiff = 0;
    let maxPriceDiff = 0;

    const matches = [];

    for (const local of localData) {
        let bestMatch = null;
        let bestDiff = Infinity;
        
        for (const b of binanceData) {
            const arrivalDiff = Math.abs(local.arrivalTimestamp - b.arrivalTimestamp);
            if (arrivalDiff < 500 && arrivalDiff < bestDiff) {
                bestDiff = arrivalDiff;
                bestMatch = b;
            }
        }
        
        if (bestMatch) {
            const latency = local.arrivalTimestamp - bestMatch.arrivalTimestamp;
            const priceDiff = Math.abs(local.price - bestMatch.price);
            
            matches.push({
                timestamp: new Date(local.arrivalTimestamp).toISOString(),
                binancePrice: bestMatch.price,
                localPrice: local.price,
                priceDiff,
                latency
            });

            totalLatency += latency;
            matchedCount++;
            
            if (latency > maxLatency) maxLatency = latency;
            if (latency < minLatency) minLatency = latency;
            
            totalPriceDiff += priceDiff;
            if (priceDiff > maxPriceDiff) maxPriceDiff = priceDiff;
        }
    }

    const avgLatency = matchedCount > 0 ? totalLatency / matchedCount : 0;
    const avgPriceDiff = matchedCount > 0 ? totalPriceDiff / matchedCount : 0;

    const reportContent = `
# Price Comparison Report: Binance vs Local

**Date:** ${new Date().toISOString()}
**Symbol:** ${SYMBOL}
**Duration:** ${TEST_DURATION_MS / 1000}s

## Summary

- **Total Updates (Binance):** ${binanceData.length}
- **Total Updates (Local):** ${localData.length}
- **Matched Data Points:** ${matchedCount}

## Accuracy Analysis

- **Average Price Difference:** ${avgPriceDiff.toFixed(2)}
- **Max Price Difference:** ${maxPriceDiff.toFixed(2)}
- **Price Match Rate:** ${matchedCount > 0 ? ((1 - (avgPriceDiff / (matches[0]?.binancePrice || 1))) * 100).toFixed(4) : 0}%

## Latency Analysis (approximate)

*Note: Latency is calculated as (Local Arrival Time - Direct Binance Arrival Time).*

- **Average Latency:** ${avgLatency.toFixed(2)} ms
- **Min Latency:** ${minLatency === Infinity ? 0 : minLatency} ms
- **Max Latency:** ${maxLatency} ms

## Detailed Samples (First 10 matches)

| Time | Binance Price | Local Price | Diff | Latency (ms) |
|------|---------------|-------------|------|--------------|
${matches.slice(0, 10).map(m => `| ${m.timestamp.split('T')[1].replace('Z', '')} | ${m.binancePrice} | ${m.localPrice} | ${m.priceDiff.toFixed(2)} | ${m.latency} |`).join('\n')}

## Conclusion

${avgPriceDiff < 0.5 ? "✅ Data is highly accurate. Minor latency is expected." : "⚠️ Significant price discrepancies detected."}
    `;

    fs.writeFileSync(path.join(__dirname, 'price_comparison_report.md'), reportContent.trim());
    console.log('Report generated: price_comparison_report.md');
}

startTest();
