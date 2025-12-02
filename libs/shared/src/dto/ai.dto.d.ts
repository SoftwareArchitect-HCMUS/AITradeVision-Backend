export declare class AIInsightsDto {
    symbol?: string;
}
export declare class AISearchDto {
    query: string;
    limit?: number;
}
export declare class AIInsightDto {
    id: number;
    newsId: number;
    symbol: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    summary: string;
    reasoning: string;
    prediction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    createdAt: Date;
}
