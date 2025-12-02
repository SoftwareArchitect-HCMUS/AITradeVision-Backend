import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NewsService } from './news.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NewsListDto } from '@shared/dto/news.dto';
import { TBaseDTO } from '@shared/dto/base.dto';

/**
 * News controller
 */
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

