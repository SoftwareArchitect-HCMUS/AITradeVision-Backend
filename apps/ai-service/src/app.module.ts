import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsProcessorModule } from './news-processor/news-processor.module';
import { GroqModule } from './groq/groq.module';
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
      synchronize: true,
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
      synchronize: true,
      logging: false,
    }),
    RedisModule,
    DatabaseModule,
    GroqModule,
    NewsProcessorModule,
  ],
})
export class AppModule {}

