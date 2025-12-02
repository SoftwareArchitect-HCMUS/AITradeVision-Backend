import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsEntity } from '../database/entities/news.entity';
import { MinioService } from '../minio/minio.service';
import { RedisService } from '../redis/redis.service';
import { ExtractionService } from './extraction/extraction.service';
import { REDIS_CHANNELS } from '@shared/core';

/**
 * Crawler service for scheduling and managing news crawling tasks
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly CRAWL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectQueue('crawl-news') private crawlQueue: Queue,
    @InjectRepository(NewsEntity) private newsRepository: Repository<NewsEntity>,
    private minioService: MinioService,
    private redisService: RedisService,
    private extractionService: ExtractionService,
  ) {}

  /**
   * Initialize scheduled crawling tasks
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing crawler service');
    
    // Schedule initial crawl
    await this.scheduleCrawl();
    
    // Schedule periodic crawls
    setInterval(() => {
      this.scheduleCrawl();
    }, this.CRAWL_INTERVAL_MS);
  }

  /**
   * Schedule crawl jobs for all sources
   */
  private async scheduleCrawl(): Promise<void> {
    const sources = [
      { name: 'bloomberg', url: 'https://www.bloomberg.com/crypto' },
      { name: 'reuters', url: 'https://www.reuters.com/finance/cryptocurrency' },
      { name: 'cointelegraph', url: 'https://cointelegraph.com' },
      { name: 'yahoo-finance', url: 'https://finance.yahoo.com/crypto' },
      { name: 'investing', url: 'https://www.investing.com/crypto' },
      { name: 'cnbc-crypto', url: 'https://www.cnbc.com/cryptocurrency' },
    ];

    for (const source of sources) {
      await this.crawlQueue.add('crawl-source', {
        source: source.name,
        url: source.url,
      });
    }

    this.logger.log(`Scheduled ${sources.length} crawl jobs`);
  }

  /**
   * Process a single article URL
   * @param url - Article URL
   * @param source - News source name
   */
  async processArticle(url: string, source: string): Promise<void> {
    try {
      // Check if article already exists
      const existing = await this.newsRepository.findOne({
        where: { url },
      });

      if (existing) {
        this.logger.debug(`Article already exists: ${url}`);
        return;
      }

      // Extract article content
      const extracted = await this.extractionService.extract(url, source);

      if (!extracted) {
        this.logger.warn(`Failed to extract content from: ${url}`);
        return;
      }

      // Upload raw HTML to MinIO
      const objectKey = this.minioService.generateObjectKey(source, url);
      await this.minioService.uploadHTML(objectKey, extracted.rawHTML);

      // Extract tickers from content
      const tickers = this.extractTickers(extracted.title + ' ' + extracted.fullText);

      // Save to database
      const news = this.newsRepository.create({
        title: extracted.title,
        summary: extracted.summary,
        fullText: extracted.fullText,
        tickers,
        source,
        publishTime: extracted.publishTime || new Date(),
        url,
        minioObjectKey: objectKey,
      });

      const savedNews = await this.newsRepository.save(news);

      // Publish event
      await this.redisService.publishNewsCreated({
        newsId: savedNews.id,
        title: savedNews.title,
        tickers: savedNews.tickers,
        publishTime: savedNews.publishTime,
        source: savedNews.source,
      });

      this.logger.log(`Processed article: ${savedNews.title}`);
    } catch (error) {
      this.logger.error(`Error processing article ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract cryptocurrency tickers from text
   * @param text - Text to analyze
   * @returns Array of ticker symbols
   */
  private extractTickers(text: string): string[] {
    const tickerPattern = /\b(BTC|ETH|SOL|BNB|ADA|XRP|DOGE|DOT|MATIC|AVAX|LINK|UNI|LTC|ATOM|ETC|XLM|ALGO|VET|ICP|FIL)USDT?\b/gi;
    const matches = text.match(tickerPattern);
    return matches ? [...new Set(matches.map(m => m.toUpperCase()))] : [];
  }
}

