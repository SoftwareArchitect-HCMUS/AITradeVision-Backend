import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { BinanceService } from './binance.service';
import { RedisCacheService } from './redis-cache.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, BinanceService, RedisCacheService],
})
export class MarketModule {}

