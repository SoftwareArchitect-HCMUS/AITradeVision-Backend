import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsEntity } from './entities/news.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewsEntity])],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

