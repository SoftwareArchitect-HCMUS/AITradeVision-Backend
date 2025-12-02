import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIInsightsDto, AISearchDto, AIInsightDto } from '@shared/dto/ai.dto';
import { TBaseDTO } from '@shared/dto/base.dto';

/**
 * AI insights controller
 */
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  /**
   * Get AI insights for a symbol
   * @param query - Query parameters
   * @returns AI insights response
   */
  @Get('insights')
  async getInsights(@Query() query: AIInsightsDto): Promise<TBaseDTO<AIInsightDto[]>> {
    try {
      const data = await this.aiService.getInsights(query.symbol);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch AI insights');
    }
  }

  /**
   * Search similar news/articles
   * @param query - Search query
   * @returns Search results
   */
  @Get('search')
  async search(@Query() query: AISearchDto): Promise<TBaseDTO<any[]>> {
    try {
      const data = await this.aiService.searchSimilar(query.query, query.limit);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Search failed');
    }
  }
}

