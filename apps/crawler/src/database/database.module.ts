import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsEntity } from './entities/news.entity';
import { ExtractionTemplateEntity } from './entities/extraction-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewsEntity, ExtractionTemplateEntity])],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

