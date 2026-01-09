import { Module } from '@nestjs/common';
import { NewsProcessorService } from './news-processor.service';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { GroqModule } from '../groq/groq.module';

@Module({
  imports: [RedisModule, DatabaseModule, GroqModule],
  providers: [NewsProcessorService],
})
export class NewsProcessorModule {}

