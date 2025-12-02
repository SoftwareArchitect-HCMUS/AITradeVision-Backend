import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsEntity } from './entities/news.entity';
import { AIInsightEntity } from './entities/ai-insight.entity';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewsEntity, AIInsightEntity], 'main'),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}

