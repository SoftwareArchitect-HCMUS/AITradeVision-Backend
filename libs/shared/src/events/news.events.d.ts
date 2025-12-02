export interface NewsCreatedEvent {
    newsId: number;
    title: string;
    tickers: string[];
    publishTime: Date;
    source: string;
}
export declare const REDIS_CHANNELS: {
    readonly NEWS_CREATED: "news_created";
    readonly PRICE_UPDATE: "price";
};
export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS];
