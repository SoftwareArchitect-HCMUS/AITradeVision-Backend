export declare enum TimeInterval {
    ONE_SECOND = "1s",
    ONE_MINUTE = "1m",
    FIVE_MINUTES = "5m",
    FIFTEEN_MINUTES = "15m",
    ONE_HOUR = "1h",
    FOUR_HOURS = "4h",
    ONE_DAY = "1d"
}
export declare class MarketHistoryDto {
    symbol: string;
    interval: TimeInterval;
    startTime?: string;
    endTime?: string;
    limit?: number;
}
export declare class OHLCVDto {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export declare class RealtimePriceDto {
    symbol: string;
    price: number;
    timestamp: number;
    volume24h?: number;
    change24h?: number;
}
