-- TimescaleDB initialization for OHLCV and tick data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Symbols table
CREATE TABLE IF NOT EXISTS symbols (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tick data table (hypertable)
CREATE TABLE IF NOT EXISTS ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell'))
);

-- Convert ticks to hypertable
SELECT create_hypertable('ticks', 'time', if_not_exists => TRUE);

-- OHLCV data table (hypertable)
CREATE TABLE IF NOT EXISTS ohlcv (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    interval VARCHAR(10) NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    UNIQUE(time, symbol, interval)
);

-- Convert ohlcv to hypertable
SELECT create_hypertable('ohlcv', 'time', if_not_exists => TRUE);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticks_symbol_time ON ticks(symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_interval_time ON ohlcv(symbol, interval, time DESC);
CREATE INDEX IF NOT EXISTS idx_symbols_symbol ON symbols(symbol);

-- Insert default symbols
INSERT INTO symbols (symbol, base_asset, quote_asset) VALUES
    ('BTCUSDT', 'BTC', 'USDT'),
    ('ETHUSDT', 'ETH', 'USDT'),
    ('SOLUSDT', 'SOL', 'USDT'),
    ('BNBUSDT', 'BNB', 'USDT'),
    ('ADAUSDT', 'ADA', 'USDT'),
    ('XRPUSDT', 'XRP', 'USDT'),
    ('DOGEUSDT', 'DOGE', 'USDT'),
    ('DOTUSDT', 'DOT', 'USDT'),
    ('MATICUSDT', 'MATIC', 'USDT'),
    ('AVAXUSDT', 'AVAX', 'USDT')
ON CONFLICT (symbol) DO NOTHING;

