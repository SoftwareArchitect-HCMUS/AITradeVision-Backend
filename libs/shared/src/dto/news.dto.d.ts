export declare class NewsDto {
    id: number;
    title: string;
    summary?: string;
    fullText: string;
    tickers: string[];
    source: string;
    publishTime: Date;
    url: string;
    createdAt: Date;
}
export declare class NewsListDto {
    news: NewsDto[];
    total: number;
    page: number;
    limit: number;
}
