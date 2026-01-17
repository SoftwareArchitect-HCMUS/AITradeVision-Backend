import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { MarketHistoryDto, OHLCVDto, RealtimePriceDto } from '@shared/dto/market.dto';
import { TimeInterval } from '@shared/dto/market.dto';
import { BinanceService } from './binance.service';
import { RedisCacheService } from './redis-cache.service';

/**
 * Market data service
 */
@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @InjectConnection('timescale')
    private timescaleConnection: Connection,
    private binanceService: BinanceService,
    private redisCache: RedisCacheService,
  ) {}

  /**
   * Get list of available trading symbols
   * @returns Array of symbol strings
   */
  async getSymbols(): Promise<string[]> {
    const query = `
      SELECT DISTINCT symbol
      FROM ohlcv
      ORDER BY symbol
    `;

    const result = await this.timescaleConnection.query(query);
    return result.map((row: any) => row.symbol);
  }

  /**
   * Get historical OHLCV data
   * @param dto - Market history query parameters
   * @returns Array of OHLCV data points
   */
  async getHistory(dto: MarketHistoryDto): Promise<OHLCVDto[]> {
    const { symbol, interval, startTime, endTime, limit = 1000 } = dto;

    let query = `
      SELECT 
        EXTRACT(EPOCH FROM time)::bigint * 1000 as timestamp,
        open,
        high,
        low,
        close,
        volume
      FROM ohlcv
      WHERE symbol = $1 AND interval = $2
    `;

    const params: any[] = [symbol.toUpperCase(), interval];
    let paramIndex = 3;

    if (startTime) {
      query += ` AND time >= $${paramIndex}`;
      params.push(new Date(startTime));
      paramIndex++;
    }

    if (endTime) {
      query += ` AND time <= $${paramIndex}`;
      params.push(new Date(endTime));
      paramIndex++;
    }

    query += ` ORDER BY time DESC LIMIT $${paramIndex}`;
    params.push(Math.min(limit, 10000)); // Cap at 10000

    const result = await this.timescaleConnection.query(query, params);

    return result.map((row: any) => ({
      timestamp: parseInt(row.timestamp, 10),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
    }));
  }

  /**
   * Get latest price for a symbol
   * @param symbol - Trading symbol
   * @returns Latest price data
   */
  async getRealtimePrice(symbol: string): Promise<RealtimePriceDto | null> {
    const query = `
      SELECT 
        symbol,
        close as price,
        EXTRACT(EPOCH FROM time)::bigint * 1000 as timestamp
      FROM ohlcv
      WHERE symbol = $1 AND interval = '1m'
      ORDER BY time DESC
      LIMIT 1
    `;

    const result = await this.timescaleConnection.query(query, [symbol.toUpperCase()]);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      symbol: row.symbol,
      price: parseFloat(row.price),
      timestamp: parseInt(row.timestamp, 10),
    };
  }

  /**
   * Get historical OHLCV data from Binance API (with Redis cache)
   * This method fetches data directly from Binance and caches it in Redis
   * @param dto - Market history query parameters
   * @returns Array of OHLCV data points
   */
  async getHistoryFromBinance(dto: MarketHistoryDto): Promise<OHLCVDto[]> {
    const { symbol, interval, startTime, endTime, limit = 1000 } = dto;

    // Convert string timestamps to numbers (query params come as strings)
    const startTimeNum = startTime ? parseInt(startTime, 10) : undefined;
    const endTimeNum = endTime ? parseInt(endTime, 10) : undefined;

    // Check cache first (only if no time range specified, as cache is for recent data)
    if (!startTimeNum && !endTimeNum) {
      const cached = await this.redisCache.getCachedKlines(symbol, interval, limit);
      if (cached) {
        this.logger.debug(`Returning cached data for ${symbol} ${interval} (${cached.length} candles)`);
        return cached;
      }
    }

    // Fetch from Binance API
    this.logger.log(`Fetching ${limit} candles from Binance for ${symbol} ${interval}`);
    const klines = await this.binanceService.getKlines(
      symbol,
      interval,
      limit,
      startTimeNum,
      endTimeNum,
    );

    // Cache the result (only if no time range specified)
    if (!startTimeNum && !endTimeNum && klines.length > 0) {
      await this.redisCache.setCachedKlines(symbol, interval, limit, klines);
    }

    this.logger.log(`Fetched ${klines.length} candles from Binance for ${symbol} ${interval}`);
    return klines;
  }
}

