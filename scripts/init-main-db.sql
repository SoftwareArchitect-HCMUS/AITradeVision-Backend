-- Main PostgreSQL database initialization
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News table
CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    full_text TEXT NOT NULL,
    tickers TEXT[] DEFAULT '{}',
    source VARCHAR(100) NOT NULL,
    publish_time TIMESTAMP NOT NULL,
    url TEXT UNIQUE NOT NULL,
    minio_object_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI insights table
CREATE TABLE IF NOT EXISTS ai_insights (
    id SERIAL PRIMARY KEY,
    news_id INTEGER REFERENCES news(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    summary TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    prediction VARCHAR(10) NOT NULL CHECK (prediction IN ('UP', 'DOWN', 'NEUTRAL')),
    confidence DECIMAL(5,2) DEFAULT 0.00 CHECK (confidence >= 0 AND confidence <= 100),
    embedding_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_news_publish_time ON news(publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_news_tickers ON news USING GIN(tickers);
CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
CREATE INDEX IF NOT EXISTS idx_ai_insights_symbol ON ai_insights(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_insights_news_id ON ai_insights(news_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);

