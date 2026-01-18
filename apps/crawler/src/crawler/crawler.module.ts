import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrawlerService } from './crawler.service';
import { CrawlerProcessor } from './crawler.processor';
import { NewsEntity } from '../database/entities/news.entity';
import { RedisModule } from '../redis/redis.module';
import { GroqModule } from '../groq/groq.module';
import { ExtractionService } from './extraction/extraction.service';
import { BloombergStrategy } from './strategies/bloomberg.strategy';
import { ReutersStrategy } from './strategies/reuters.strategy';
import { CointelegraphStrategy } from './strategies/cointelegraph.strategy';
import { YahooFinanceStrategy } from './strategies/yahoo-finance.strategy';
import { InvestingStrategy } from './strategies/investing.strategy';
import { CNBCCryptoStrategy } from './strategies/cnbc-crypto.strategy';
import { GenericStrategy } from './strategies/generic.strategy';
import { ExtractionTemplateEntity } from '../database/entities/extraction-template.entity';
import { TemplateService } from './extraction/template.service';
import { TemplateGeneratorService } from './extraction/template-generator.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'crawl-news',
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour (3600 seconds)
          count: 50, // Keep max 50 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours (86400 seconds)
          count: 20, // Keep max 20 failed jobs
        },
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds delay
        },
      },
    }),
    TypeOrmModule.forFeature([NewsEntity, ExtractionTemplateEntity]),
    RedisModule,
    GroqModule,
  ],
  providers: [
    CrawlerService,
    CrawlerProcessor,
    ExtractionService,
    TemplateService,
    TemplateGeneratorService,
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

