import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { MarketHistoryDto, OHLCVDto, RealtimePriceDto } from '@shared/dto/market.dto';
import { TimeInterval } from '@shared/dto/market.dto';

/**
 * Market data service
 */
@Injectable()
export class MarketService {
  constructor(
    @InjectConnection('timescale')
    private timescaleConnection: Connection,
  ) {}

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
}

