import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketHistoryDto, RealtimePriceDto } from '@shared/dto/market.dto';
import { TBaseDTO } from '@shared/dto/base.dto';
import { OHLCVDto } from '@shared/dto/market.dto';

/**
 * Market data controller
 */
@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /**
   * Get market history (OHLCV data)
   * @param query - Query parameters
   * @returns Market history response
   */
  @Get('history')
  async getHistory(@Query() query: MarketHistoryDto): Promise<TBaseDTO<OHLCVDto[]>> {
    try {
      const data = await this.marketService.getHistory(query);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch market history');
    }
  }

  /**
   * Get real-time price
   * @param symbol - Trading symbol
   * @returns Real-time price response
   */
  @Get('realtime')
  async getRealtime(@Query('symbol') symbol: string): Promise<TBaseDTO<RealtimePriceDto>> {
    try {
      if (!symbol) {
        return TBaseDTO.error('Symbol parameter is required');
      }

      const data = await this.marketService.getRealtimePrice(symbol);
      if (!data) {
        return TBaseDTO.error('Price data not found');
      }

      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch real-time price');
    }
  }
}

