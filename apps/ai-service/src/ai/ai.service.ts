import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AIInsightDto } from '@shared/dto/ai.dto';

/**
 * AI service for providing insights and search
 */
@Injectable()
export class AIService {
  constructor(
    private databaseService: DatabaseService,
  ) {}

  /**
   * Get AI insights for a symbol
   * @param symbol - Trading symbol (optional)
   * @returns Array of AI insights
   */
  async getInsights(symbol?: string): Promise<AIInsightDto[]> {
    if (!symbol) {
      // Return recent insights for all symbols
      const insights = await this.databaseService.getInsightsBySymbol('BTCUSDT', 10);
      return this.mapToDto(insights);
    }

    const insights = await this.databaseService.getInsightsBySymbol(symbol, 10);
    return this.mapToDto(insights);
  }


  /**
   * Map entities to DTOs
   * @param insights - AI insight entities
   * @returns Array of AI insight DTOs
   */
  private mapToDto(insights: any[]): AIInsightDto[] {
    return insights.map(insight => ({
      id: insight.id,
      newsId: insight.newsId,
      symbol: insight.symbol,
      sentiment: insight.sentiment,
      summary: insight.summary,
      reasoning: insight.reasoning,
      prediction: insight.prediction,
      confidence: parseFloat(insight.confidence),
      createdAt: insight.createdAt,
    }));
  }
}

