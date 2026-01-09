import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIInsightEntity } from './entities/ai-insight.entity';
import { AIInsightDto } from '@shared/dto/ai.dto';
import { AICacheService } from './ai-cache.service';

/**
 * AI service for providing insights
 */
@Injectable()
export class AIService {
  constructor(
    @InjectRepository(AIInsightEntity, 'main')
    private insightRepository: Repository<AIInsightEntity>,
    private aiCacheService: AICacheService,
  ) {}

  /**
   * Get AI insights for a symbol
   * @param symbol - Trading symbol (optional)
   * @param limit - Maximum number of insights
   * @returns Array of AI insights
   */
  async getInsights(symbol?: string, limit: number = 10): Promise<AIInsightDto[]> {
    const queryBuilder = this.insightRepository
      .createQueryBuilder('insight')
      .leftJoinAndSelect('insight.news', 'news')
      .orderBy('insight.createdAt', 'DESC')
      .take(limit);

    if (symbol) {
      queryBuilder.where('insight.symbol = :symbol', { symbol: symbol.toUpperCase() });
    }

    const insights = await queryBuilder.getMany();
    return insights.map(this.mapToDto);
  }

  /**
   * Get AI insights by news ID
   * Checks Redis cache first, then database if cache miss
   * @param newsId - News ID
   * @returns Array of AI insights
   */
  async getInsightsByNewsId(newsId: number): Promise<AIInsightDto[]> {
    // Try to get from Redis cache first
    const cached = await this.aiCacheService.getCachedInsightsByNewsId(newsId);
    if (cached) {
      return cached;
    }

    // Cache miss - query database
    const insights = await this.insightRepository.find({
      where: { newsId },
      relations: ['news'],
      order: { createdAt: 'DESC' },
    });

    const insightsDto = insights.map(this.mapToDto);

    // Cache the result for 1 hour
    await this.aiCacheService.setCachedInsightsByNewsId(newsId, insightsDto);

    return insightsDto;
  }

  /**
   * Get latest AI insights across all symbols
   * @param limit - Maximum number of insights
   * @returns Array of AI insights
   */
  async getLatestInsights(limit: number = 20): Promise<AIInsightDto[]> {
    const insights = await this.insightRepository.find({
      relations: ['news'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return insights.map(this.mapToDto);
  }

  /**
   * Map entity to DTO
   * @param entity - AI insight entity
   * @returns AI insight DTO
   */
  private mapToDto(entity: AIInsightEntity): AIInsightDto {
    return {
      id: entity.id,
      newsId: entity.newsId,
      symbol: entity.symbol,
      sentiment: entity.sentiment,
      summary: entity.summary,
      reasoning: entity.reasoning,
      prediction: entity.prediction,
      confidence: entity.confidence,
      createdAt: entity.createdAt,
    };
  }
}

