import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { OHLCVDto } from '@shared/dto/market.dto';

/**
 * Redis cache service for market data
 * Caches Binance klines data to reduce API calls
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes (data changes frequently)
  private readonly CACHE_KEY_PREFIX = 'binance_klines:';

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Redis cache service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Generate cache key
   * @param symbol - Trading symbol
   * @param interval - Time interval
   * @param limit - Number of candles
   * @returns Cache key
   */
  private getCacheKey(symbol: string, interval: string, limit: number): string {
    return `${this.CACHE_KEY_PREFIX}${symbol.toUpperCase()}:${interval}:${limit}`;
  }

  /**
   * Get cached klines data
   * @param symbol - Trading symbol
   * @param interval - Time interval
   * @param limit - Number of candles
   * @returns Cached data or null
   */
  async getCachedKlines(
    symbol: string,
    interval: string,
    limit: number,
  ): Promise<OHLCVDto[] | null> {
    try {
      const key = this.getCacheKey(symbol, interval, limit);
      const cached = await this.client.get(key);

      if (cached) {
        this.logger.debug(`Cache hit for ${key}`);
        return JSON.parse(cached) as OHLCVDto[];
      }

      this.logger.debug(`Cache miss for ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cached klines: ${error}`);
      return null;
    }
  }

  /**
   * Cache klines data
   * @param symbol - Trading symbol
   * @param interval - Time interval
   * @param limit - Number of candles
   * @param data - OHLCV data to cache
   */
  async setCachedKlines(
    symbol: string,
    interval: string,
    limit: number,
    data: OHLCVDto[],
  ): Promise<void> {
    try {
      const key = this.getCacheKey(symbol, interval, limit);
      const jsonData = JSON.stringify(data);

      // Calculate approximate size
      const sizeKB = Buffer.byteLength(jsonData, 'utf8') / 1024;
      this.logger.debug(`Caching ${data.length} candles for ${key} (${sizeKB.toFixed(2)} KB)`);

      // Set with TTL
      await this.client.setex(key, this.CACHE_TTL, jsonData);
      this.logger.debug(`Cached ${data.length} candles for ${key} (TTL: ${this.CACHE_TTL}s)`);
    } catch (error) {
      this.logger.error(`Error caching klines: ${error}`);
      // Don't throw - caching failure shouldn't break the request
    }
  }

  /**
   * Invalidate cache for a symbol
   * @param symbol - Trading symbol
   * @param interval - Time interval (optional)
   */
  async invalidateCache(symbol: string, interval?: string): Promise<void> {
    try {
      const pattern = interval
        ? `${this.CACHE_KEY_PREFIX}${symbol.toUpperCase()}:${interval}:*`
        : `${this.CACHE_KEY_PREFIX}${symbol.toUpperCase()}:*`;

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} cache keys for ${symbol}`);
      }
    } catch (error) {
      this.logger.error(`Error invalidating cache: ${error}`);
    }
  }
}

