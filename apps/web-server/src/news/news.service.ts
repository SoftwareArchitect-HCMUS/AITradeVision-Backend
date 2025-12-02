import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsEntity } from './entities/news.entity';
import { NewsDto, NewsListDto } from '@shared/dto/news.dto';

/**
 * News service
 */
@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(NewsEntity, 'main')
    private newsRepository: Repository<NewsEntity>,
  ) {}

  /**
   * Get latest news articles
   * @param limit - Maximum number of articles to return
   * @param page - Page number (1-based)
   * @returns News list
   */
  async getLatest(limit: number = 20, page: number = 1): Promise<NewsListDto> {
    const skip = (page - 1) * limit;

    const [news, total] = await this.newsRepository.findAndCount({
      order: { publishTime: 'DESC' },
      take: limit,
      skip,
    });

    return {
      news: news.map(this.mapToDto),
      total,
      page,
      limit,
    };
  }

  /**
   * Map entity to DTO
   * @param entity - News entity
   * @returns News DTO
   */
  private mapToDto(entity: NewsEntity): NewsDto {
    return {
      id: entity.id,
      title: entity.title,
      summary: entity.summary,
      fullText: entity.fullText,
      tickers: entity.tickers,
      source: entity.source,
      publishTime: entity.publishTime,
      url: entity.url,
      createdAt: entity.createdAt,
    };
  }
}

