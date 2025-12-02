import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CHANNELS, NewsCreatedEvent } from '@shared/core';

/**
 * Redis service for Pub/Sub messaging
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: Redis;
  private subscriber: Redis;

  constructor() {
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  /**
   * Initialize Redis connections
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Redis service initialized');
  }

  /**
   * Cleanup Redis connections
   */
  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  /**
   * Publish news created event
   * @param event - News created event data
   */
  async publishNewsCreated(event: NewsCreatedEvent): Promise<void> {
    try {
      await this.publisher.publish(REDIS_CHANNELS.NEWS_CREATED, JSON.stringify(event));
      this.logger.debug(`Published news_created event for news ID: ${event.newsId}`);
    } catch (error) {
      this.logger.error('Failed to publish news_created event', error);
      throw error;
    }
  }
}

