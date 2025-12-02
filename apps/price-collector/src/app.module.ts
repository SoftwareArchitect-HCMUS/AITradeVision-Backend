import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BinanceModule } from './binance/binance.module';
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
    RedisModule,
    DatabaseModule,
    BinanceModule,
  ],
})
export class AppModule {}

