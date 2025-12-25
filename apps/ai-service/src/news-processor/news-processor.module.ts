import { Module } from '@nestjs/common';
import { NewsProcessorService } from './news-processor.service';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { GroqModule } from '../groq/groq.module';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [RedisModule, DatabaseModule, GroqModule, QdrantModule],
  providers: [NewsProcessorService],
})
export class NewsProcessorModule {}

