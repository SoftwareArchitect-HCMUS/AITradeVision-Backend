# Price Comparison Test

This test compares real-time price data from the local AITradeVision server against direct Binance WebSocket data.

## Setup

1. Navigate to this directory:
   ```bash
   cd tests/price-comparison
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

## Running the Test

1. Ensure your backend server is running (usually on port 3000).

2. Run the test script:
   ```bash
   npm test
   ```

3. View results in `price_comparison_report.md`.
