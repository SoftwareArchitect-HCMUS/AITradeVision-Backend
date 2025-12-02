import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectConnection } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { NewsEntity } from './entities/news.entity';
import { AIInsightEntity } from './entities/ai-insight.entity';

/**
 * Database service for AI service
 */
@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(NewsEntity, 'main')
    private newsRepository: Repository<NewsEntity>,
    @InjectRepository(AIInsightEntity, 'main')
    private insightRepository: Repository<AIInsightEntity>,
    @InjectConnection('timescale')
    private timescaleConnection: Connection,
  ) {}

  /**
   * Get news by ID
   * @param newsId - News ID
   * @returns News entity or null
   */
  async getNewsById(newsId: number): Promise<NewsEntity | null> {
    return this.newsRepository.findOne({ where: { id: newsId } });
  }

  /**
   * Get historical price data for a symbol
   * @param symbol - Trading symbol
   * @param hours - Number of hours to look back
   * @returns Array of price data points
   */
  async getHistoricalPrice(symbol: string, hours: number = 24): Promise<Array<{ timestamp: number; price: number }>> {
    const query = `
      SELECT 
        EXTRACT(EPOCH FROM time)::bigint * 1000 as timestamp,
        close as price
      FROM ohlcv
      WHERE symbol = $1 AND interval = '1m'
        AND time >= NOW() - INTERVAL '${hours} hours'
      ORDER BY time ASC
    `;

    const result = await this.timescaleConnection.query(query, [symbol.toUpperCase()]);
    return result.map((row: any) => ({
      timestamp: parseInt(row.timestamp, 10),
      price: parseFloat(row.price),
    }));
  }

  /**
   * Save AI insight
   * @param insight - AI insight data
   * @returns Saved insight entity
   */
  async saveInsight(insight: Partial<AIInsightEntity>): Promise<AIInsightEntity> {
    const entity = this.insightRepository.create(insight);
    return this.insightRepository.save(entity);
  }

  /**
   * Get insights by symbol
   * @param symbol - Trading symbol
   * @param limit - Maximum number of insights
   * @returns Array of insight entities
   */
  async getInsightsBySymbol(symbol: string, limit: number = 10): Promise<AIInsightEntity[]> {
    return this.insightRepository.find({
      where: { symbol: symbol.toUpperCase() },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['news'],
    });
  }
}

