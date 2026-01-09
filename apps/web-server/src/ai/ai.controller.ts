import { Controller, Get, Query, UseGuards, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIInsightDto, AIInsightsDto } from '@shared/dto/ai.dto';
import { TBaseDTO } from '@shared/dto/base.dto';

/**
 * AI insights controller
 */
@ApiTags('ai')
@ApiBearerAuth('JWT-auth')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  /**
   * Get AI insights for a symbol
   * @param query - Query parameters
   * @returns AI insights response
   */
  @Get('insights')
  @ApiOperation({ 
    summary: 'Get AI insights for a symbol', 
    description: 'Retrieve AI-generated insights (sentiment, prediction, reasoning) for a specific trading symbol or all symbols' 
  })
  @ApiQuery({ 
    name: 'symbol', 
    required: false, 
    description: 'Trading symbol (e.g., BTCUSDT, ETHUSDT). If not provided, returns insights for all symbols',
    example: 'BTCUSDT'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Maximum number of insights to return (default: 10, max: 50)',
    example: 10
  })
  @ApiResponse({ 
    status: 200, 
    description: 'AI insights retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              newsId: { type: 'number', example: 123 },
              symbol: { type: 'string', example: 'BTCUSDT' },
              sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'], example: 'positive' },
              summary: { type: 'string', example: 'Bitcoin shows strong bullish momentum...' },
              reasoning: { type: 'string', example: 'The news indicates...' },
              prediction: { type: 'string', enum: ['UP', 'DOWN', 'NEUTRAL'], example: 'UP' },
              confidence: { type: 'number', example: 85.5 },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  async getInsights(
    @Query() query: AIInsightsDto,
  ): Promise<TBaseDTO<AIInsightDto[]>> {
    try {
      const limitNum = query.limit ? Math.min(query.limit, 50) : 10;
      const data = await this.aiService.getInsights(query.symbol, limitNum);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch AI insights');
    }
  }

  /**
   * Get latest AI insights across all symbols
   * @param limit - Maximum number of insights
   * @returns Latest AI insights response
   */
  @Get('insights/latest')
  @ApiOperation({ 
    summary: 'Get latest AI insights', 
    description: 'Retrieve the most recent AI-generated insights across all trading symbols' 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Maximum number of insights to return (default: 20, max: 100)',
    example: 20
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Latest AI insights retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/AIInsightDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  async getLatestInsights(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<TBaseDTO<AIInsightDto[]>> {
    try {
      const limitNum = limit ? Math.min(limit, 100) : 20;
      const data = await this.aiService.getLatestInsights(limitNum);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch latest AI insights');
    }
  }

  /**
   * Get AI insights by news ID
   * @param newsId - News ID
   * @returns AI insights for the news article
   */
  @Get('insights/news/:newsId')
  @ApiOperation({ 
    summary: 'Get AI insights by news ID', 
    description: 'Retrieve all AI-generated insights for a specific news article' 
  })
  @ApiParam({ 
    name: 'newsId', 
    description: 'News article ID',
    example: 123
  })
  @ApiResponse({ 
    status: 200, 
    description: 'AI insights for news retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/AIInsightDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'News article not found' })
  async getInsightsByNewsId(
    @Param('newsId', ParseIntPipe) newsId: number,
  ): Promise<TBaseDTO<AIInsightDto[]>> {
    try {
      const data = await this.aiService.getInsightsByNewsId(newsId);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch AI insights for news');
    }
  }
}

