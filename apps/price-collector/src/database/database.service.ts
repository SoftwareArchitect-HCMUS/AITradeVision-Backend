import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { TickData, OHLCVData } from '@shared/types/common.types';

/**
 * TimescaleDB service for storing tick and OHLCV data
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private ohlcvCache: Map<string, { open: number; high: number; low: number; close: number; volume: number; startTime: number }> = new Map();

  constructor() {
    this.pool = new Pool({
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5432', 10),
      user: process.env.TIMESCALE_USER || 'timescale_user',
      password: process.env.TIMESCALE_PASSWORD || 'timescale_pass',
      database: process.env.TIMESCALE_DB || 'timescale_db',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Initialize database connection
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      this.logger.log('TimescaleDB connection established');
    } catch (error) {
      this.logger.error('Failed to connect to TimescaleDB', error);
      throw error;
    }
  }

  /**
   * Cleanup database connection
   */
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Insert tick data
   * @param tick - Tick data
   */
  async insertTick(tick: TickData): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'INSERT INTO ticks (time, symbol, price, volume, side) VALUES ($1, $2, $3, $4, $5)',
        [new Date(tick.timestamp), tick.symbol, tick.price, tick.volume, tick.side],
      );

      // Update OHLCV cache for 1s interval
      await this.updateOHLCVCache(tick, '1s');
      
      // Update OHLCV cache for 1m interval
      await this.updateOHLCVCache(tick, '1m');
    } catch (error) {
      this.logger.error('Failed to insert tick', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update OHLCV cache and insert when interval completes
   * @param tick - Tick data
   * @param interval - Time interval (1s, 1m)
   */
  private async updateOHLCVCache(tick: TickData, interval: string): Promise<void> {
    const now = Date.now();
    const intervalMs = interval === '1s' ? 1000 : 60000;
    const intervalStart = Math.floor(now / intervalMs) * intervalMs;
    const cacheKey = `${tick.symbol}-${interval}-${intervalStart}`;

    let ohlcv = this.ohlcvCache.get(cacheKey);

    if (!ohlcv) {
      // New interval, initialize
      ohlcv = {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
        startTime: intervalStart,
      };
      this.ohlcvCache.set(cacheKey, ohlcv);
    } else {
      // Update existing interval
      ohlcv.high = Math.max(ohlcv.high, tick.price);
      ohlcv.low = Math.min(ohlcv.low, tick.price);
      ohlcv.close = tick.price;
      ohlcv.volume += tick.volume;
    }

    // For 1s intervals, insert immediately
    // For 1m intervals, insert when minute completes
    if (interval === '1s' || (interval === '1m' && now >= intervalStart + intervalMs)) {
      await this.insertOHLCV({
        symbol: tick.symbol,
        interval,
        timestamp: intervalStart,
        open: ohlcv.open,
        high: ohlcv.high,
        low: ohlcv.low,
        close: ohlcv.close,
        volume: ohlcv.volume,
      });

      // Clean up old cache entries
      if (interval === '1m') {
        this.ohlcvCache.delete(cacheKey);
      }
    }
  }

  /**
   * Insert OHLCV data
   * @param ohlcv - OHLCV data
   */
  async insertOHLCV(ohlcv: OHLCVData): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO ohlcv (time, symbol, interval, open, high, low, close, volume)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, symbol, interval) DO UPDATE SET
           high = GREATEST(ohlcv.high, EXCLUDED.high),
           low = LEAST(ohlcv.low, EXCLUDED.low),
           close = EXCLUDED.close,
           volume = ohlcv.volume + EXCLUDED.volume`,
        [
          new Date(ohlcv.timestamp),
          ohlcv.symbol,
          ohlcv.interval,
          ohlcv.open,
          ohlcv.high,
          ohlcv.low,
          ohlcv.close,
          ohlcv.volume,
        ],
      );
    } catch (error) {
      this.logger.error('Failed to insert OHLCV', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active symbols from database
   * @returns Array of symbol strings
   */
  async getActiveSymbols(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT symbol FROM symbols WHERE is_active = true',
      );
      return result.rows.map(row => row.symbol);
    } catch (error) {
      this.logger.error('Failed to get active symbols', error);
      return [];
    } finally {
      client.release();
    }
  }
}

