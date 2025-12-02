/**
 * News created event payload
 */
export interface NewsCreatedEvent {
  newsId: number;
  title: string;
  tickers: string[];
  publishTime: Date;
  source: string;
}

/**
 * Redis Pub/Sub channels
 */
export const REDIS_CHANNELS = {
  NEWS_CREATED: 'news_created',
  PRICE_UPDATE: 'price',
} as const;

export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS];

