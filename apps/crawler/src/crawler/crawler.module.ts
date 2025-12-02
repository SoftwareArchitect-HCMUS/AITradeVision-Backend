import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrawlerService } from './crawler.service';
import { CrawlerProcessor } from './crawler.processor';
import { NewsEntity } from '../database/entities/news.entity';
import { MinioModule } from '../minio/minio.module';
import { RedisModule } from '../redis/redis.module';
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
    }),
    TypeOrmModule.forFeature([NewsEntity]),
    MinioModule,
    RedisModule,
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

