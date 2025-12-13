import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrawlerService } from './crawler.service';
import { CrawlerProcessor } from './crawler.processor';
import { NewsEntity } from '../database/entities/news.entity';
import { MinioModule } from '../minio/minio.module';
import { RedisModule } from '../redis/redis.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ExtractionService } from './extraction/extraction.service';
import { BloombergStrategy } from './strategies/bloomberg.strategy';
import { ReutersStrategy } from './strategies/reuters.strategy';
import { CointelegraphStrategy } from './strategies/cointelegraph.strategy';
import { YahooFinanceStrategy } from './strategies/yahoo-finance.strategy';
import { InvestingStrategy } from './strategies/investing.strategy';
import { CNBCCryptoStrategy } from './strategies/cnbc-crypto.strategy';
import { GenericStrategy } from './strategies/generic.strategy';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'crawl-news',
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour (3600 seconds)
          count: 50, // Keep max 50 completed jobs (giảm từ 100 xuống 50)
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours (86400 seconds)
          count: 20, // Keep max 20 failed jobs (giảm từ 50 xuống 20)
        },
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds delay
        },
      },
    }),
    TypeOrmModule.forFeature([NewsEntity]),
    MinioModule,
    RedisModule,
    GeminiModule,
  ],
  providers: [
    CrawlerService,
    CrawlerProcessor,
    ExtractionService,
    BloombergStrategy,
    ReutersStrategy,
    CointelegraphStrategy,
    YahooFinanceStrategy,
    InvestingStrategy,
    CNBCCryptoStrategy,
    GenericStrategy,
  ],
})
export class CrawlerModule {}

