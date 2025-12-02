-- Seed additional symbols if needed
INSERT INTO symbols (symbol, base_asset, quote_asset) VALUES
    ('LINKUSDT', 'LINK', 'USDT'),
    ('UNIUSDT', 'UNI', 'USDT'),
    ('LTCUSDT', 'LTC', 'USDT'),
    ('ATOMUSDT', 'ATOM', 'USDT'),
    ('ETCUSDT', 'ETC', 'USDT'),
    ('XLMUSDT', 'XLM', 'USDT'),
    ('ALGOUSDT', 'ALGO', 'USDT'),
    ('VETUSDT', 'VET', 'USDT'),
    ('ICPUSDT', 'ICP', 'USDT'),
    ('FILUSDT', 'FIL', 'USDT')
ON CONFLICT (symbol) DO NOTHING;

