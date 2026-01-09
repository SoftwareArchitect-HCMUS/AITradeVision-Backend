import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AICacheService } from './ai-cache.service';
import { AIInsightEntity } from './entities/ai-insight.entity';
import { NewsEntity } from '../news/entities/news.entity';

/**
 * AI module
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AIInsightEntity, NewsEntity], 'main'),
  ],
  controllers: [AIController],
  providers: [AIService, AICacheService],
  exports: [AIService],
})
export class AIModule {}

