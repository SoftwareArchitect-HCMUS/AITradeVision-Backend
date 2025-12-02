import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [BinanceService],
  exports: [BinanceService],
})
export class BinanceModule {}

