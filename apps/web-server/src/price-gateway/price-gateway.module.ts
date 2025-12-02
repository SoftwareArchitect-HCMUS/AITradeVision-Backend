import { Module } from '@nestjs/common';
import { PriceGateway } from './price.gateway';
import { RedisService } from './redis.service';

@Module({
  providers: [PriceGateway, RedisService],
})
export class PriceGatewayModule {}

