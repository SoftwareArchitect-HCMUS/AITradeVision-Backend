import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CHANNELS } from '@shared/events/news.events';
import { PriceUpdate } from '@shared/types/common.types';

/**
 * Redis service for subscribing to price updates
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private subscriber: Redis;

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
    this.logger.log('Redis subscriber initialized');
  }

  /**
   * Cleanup Redis subscriber
   */
  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit();
  }

  /**
   * Subscribe to price updates for a symbol
   * @param symbol - Trading symbol
   * @param callback - Callback function for price updates
   */
  subscribeToPrice(symbol: string, callback: (update: PriceUpdate) => void): void {
    const channel = `${REDIS_CHANNELS.PRICE_UPDATE}.${symbol.toLowerCase()}`;
    
    this.subscriber.subscribe(channel, (err, count) => {
      if (err) {
        this.logger.error(`❌ Failed to subscribe to channel: ${channel}`, err);
      } else {
        this.logger.log(`📡 Successfully subscribed to ${channel}. Total channels: ${count}`);
      }
    });
    
    this.subscriber.on('message', (ch, message) => {
      this.logger.debug(`📨 Redis message received on ${ch}: ${message}`);
      if (ch === channel) {
        try {
          const update = JSON.parse(message) as PriceUpdate;
          callback(update);
        } catch (error) {
          this.logger.error('Error parsing price update', error);
        }
      }
    });

    this.logger.log(`Subscribed to price updates for ${symbol}`);
  }

  /**
   * Unsubscribe from price updates for a symbol
   * @param symbol - Trading symbol
   */
  unsubscribeFromPrice(symbol: string): void {
    const channel = `${REDIS_CHANNELS.PRICE_UPDATE}.${symbol.toLowerCase()}`;
    this.subscriber.unsubscribe(channel);
    this.logger.log(`Unsubscribed from price updates for ${symbol}`);
  }
}

