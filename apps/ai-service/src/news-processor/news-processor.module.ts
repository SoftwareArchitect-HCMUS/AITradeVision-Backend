import { Module } from '@nestjs/common';
import { NewsProcessorService } from './news-processor.service';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { GeminiModule } from '../gemini/gemini.module';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [RedisModule, DatabaseModule, GeminiModule, QdrantModule],
  providers: [NewsProcessorService],
})
export class NewsProcessorModule {}

