import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NewsListDto } from '@shared/dto/news.dto';
import { TBaseDTO } from '@shared/dto/base.dto';

/**
 * News controller
 */
@ApiTags('news')
@ApiBearerAuth('JWT-auth')
@Controller('news')
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * Get latest news
   * @param limit - Maximum number of articles
   * @param page - Page number
   * @returns News list response
   */
  @Get('latest')
  @ApiOperation({ summary: 'Get latest news', description: 'Retrieve the latest news articles with pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of articles (max 100, default 20)', example: '20' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (starts from 1)', example: '1' })
  @ApiResponse({ 
    status: 200, 
    description: 'News list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/NewsListDto' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  async getLatest(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<TBaseDTO<NewsListDto>> {
    try {
      const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;
      const pageNum = page ? Math.max(parseInt(page, 10), 1) : 1;

      const data = await this.newsService.getLatest(limitNum, pageNum);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch news');
    }
  }
}

