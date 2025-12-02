import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CHANNELS, NewsCreatedEvent } from '@shared/events/news.events';

/**
 * Redis service for subscribing to news events
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private subscriber: Redis;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor() {
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  /**
   * Initialize Redis subscriber
   */
  async onModuleInit(): Promise<void> {
    this.subscriber.subscribe(REDIS_CHANNELS.NEWS_CREATED);
    
    this.subscriber.on('message', (channel, message) => {
      if (channel === REDIS_CHANNELS.NEWS_CREATED) {
        try {
          const event = JSON.parse(message) as NewsCreatedEvent;
          const handler = this.messageHandlers.get(REDIS_CHANNELS.NEWS_CREATED);
          if (handler) {
            handler(event);
          }
        } catch (error) {
          this.logger.error('Error parsing news_created event', error);
        }
      }
    });

    this.logger.log('Redis subscriber initialized');
  }

  /**
   * Cleanup Redis subscriber
   */
  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit();
  }

  /**
   * Subscribe to news created events
   * @param handler - Event handler function
   */
  onNewsCreated(handler: (event: NewsCreatedEvent) => void): void {
    this.messageHandlers.set(REDIS_CHANNELS.NEWS_CREATED, handler);
  }
}

