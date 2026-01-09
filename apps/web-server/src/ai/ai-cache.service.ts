import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AIInsightDto } from '@shared/dto/ai.dto';

/**
 * Redis cache service for AI insights
 * Caches AI insights to reduce database queries
 */
@Injectable()
export class AICacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AICacheService.name);
  private client: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour (as requested)
  private readonly CACHE_KEY_PREFIX = 'ai_insights:';

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('AI cache service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Get cache key for insights by news ID
   * @param newsId - News ID
   * @returns Cache key
   */
  private getNewsInsightsCacheKey(newsId: number): string {
    return `${this.CACHE_KEY_PREFIX}news:${newsId}`;
  }

  /**
   * Get cached insights by news ID
   * @param newsId - News ID
   * @returns Cached insights or null
   */
  async getCachedInsightsByNewsId(newsId: number): Promise<AIInsightDto[] | null> {
    try {
      const key = this.getNewsInsightsCacheKey(newsId);
      const cached = await this.client.get(key);

      if (cached) {
        this.logger.debug(`Cache hit for insights by news ID: ${newsId}`);
        return JSON.parse(cached) as AIInsightDto[];
      }

      this.logger.debug(`Cache miss for insights by news ID: ${newsId}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cached insights by news ID: ${error}`);
      return null;
    }
  }

  /**
   * Cache insights by news ID
   * @param newsId - News ID
   * @param insights - Insights to cache
   */
  async setCachedInsightsByNewsId(newsId: number, insights: AIInsightDto[]): Promise<void> {
    try {
      const key = this.getNewsInsightsCacheKey(newsId);
      const jsonData = JSON.stringify(insights);

      await this.client.setex(key, this.CACHE_TTL, jsonData);
      this.logger.debug(`Cached ${insights.length} insights for news ID ${newsId} (TTL: ${this.CACHE_TTL}s)`);
    } catch (error) {
      this.logger.error(`Error caching insights by news ID: ${error}`);
      // Don't throw - caching failure shouldn't break the request
    }
  }

  /**
   * Invalidate cache for a news ID
   * @param newsId - News ID
   */
  async invalidateNewsInsightsCache(newsId: number): Promise<void> {
    try {
      const key = this.getNewsInsightsCacheKey(newsId);
      await this.client.del(key);
      this.logger.debug(`Invalidated cache for news ID: ${newsId}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache for news ID: ${error}`);
    }
  }
}

