import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CHANNELS } from '@shared/events/news.events';
import { PriceUpdate } from '@shared/types/common.types';

/**
 * Redis service for Pub/Sub messaging
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: Redis;

  constructor() {
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  /**
   * Initialize Redis connection
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Redis service initialized');
  }

  /**
   * Cleanup Redis connection
   */
  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit();
  }

  /**
   * Publish price update
   * @param update - Price update data
   */
  async publishPriceUpdate(update: PriceUpdate): Promise<void> {
    try {
      const channel = `${REDIS_CHANNELS.PRICE_UPDATE}.${update.symbol.toLowerCase()}`;
      await this.publisher.publish(channel, JSON.stringify(update));
    } catch (error) {
      this.logger.error('Failed to publish price update', error);
      throw error;
    }
  }
}

