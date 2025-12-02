import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIController } from './ai/ai.controller';
import { AIService } from './ai/ai.service';
import { NewsProcessorModule } from './news-processor/news-processor.module';
import { QdrantModule } from './qdrant/qdrant.module';
import { GeminiModule } from './gemini/gemini.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '../../.env',
        process.env.ENV_FILE || '.env',
      ],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      name: 'main',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: process.env.POSTGRES_USER || 'crypto_user',
      password: process.env.POSTGRES_PASSWORD || 'crypto_pass',
      database: process.env.POSTGRES_DB || 'crypto_main',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: false,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      name: 'timescale',
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5433', 10),
      username: process.env.TIMESCALE_USER || 'timescale_user',
      password: process.env.TIMESCALE_PASSWORD || 'timescale_pass',
      database: process.env.TIMESCALE_DB || 'timescale_db',
      synchronize: false,
      logging: false,
    }),
    RedisModule,
    DatabaseModule,
    QdrantModule,
    GeminiModule,
    NewsProcessorModule,
  ],
  controllers: [AIController],
  providers: [AIService],
})
export class AppModule {}

