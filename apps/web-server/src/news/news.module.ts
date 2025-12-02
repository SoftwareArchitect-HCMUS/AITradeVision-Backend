import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsEntity } from './entities/news.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewsEntity], 'main')],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}

