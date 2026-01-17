import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketHistoryDto, RealtimePriceDto } from '@shared/dto/market.dto';
import { TBaseDTO } from '@shared/dto/base.dto';
import { OHLCVDto } from '@shared/dto/market.dto';

/**
 * Market data controller
 */
@ApiTags('market')
@ApiBearerAuth('JWT-auth')
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
  @ApiOperation({ summary: 'Get market history', description: 'Retrieve historical OHLCV (Open, High, Low, Close, Volume) data for a trading symbol' })
  @ApiQuery({ name: 'symbol', required: true, description: 'Trading symbol (e.g., BTCUSDT)', example: 'BTCUSDT' })
  @ApiQuery({ name: 'interval', required: false, description: 'Time interval (1s, 1m, 5m, 1h, 1d)', example: '1m' })
  @ApiQuery({ name: 'startTime', required: false, description: 'Start timestamp (Unix milliseconds)', example: 1609459200000 })
  @ApiQuery({ name: 'endTime', required: false, description: 'End timestamp (Unix milliseconds)', example: 1609545600000 })
  @ApiResponse({ 
    status: 200, 
    description: 'Market history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { 
          type: 'array',
          items: { $ref: '#/components/schemas/OHLCVDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async getHistory(@Query() query: MarketHistoryDto): Promise<TBaseDTO<OHLCVDto[]>> {
    try {
      const data = await this.marketService.getHistory(query);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch market history');
    }
  }

  /**
   * Get market history from Binance API (with Redis cache)
   * @param query - Query parameters
   * @returns Market history response from Binance
   */
  @Get('history/binance')
  @ApiOperation({ 
    summary: 'Get market history from Binance', 
    description: 'Retrieve historical OHLCV data directly from Binance API. Data is cached in Redis for 5 minutes to reduce API calls.' 
  })
  @ApiQuery({ name: 'symbol', required: true, description: 'Trading symbol (e.g., BTCUSDT)', example: 'BTCUSDT' })
  @ApiQuery({ name: 'interval', required: false, description: 'Time interval (1m, 5m, 1h, 1d). Default: 1m', example: '1m' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of candles (max 1000). Default: 1000', example: 1000 })
  @ApiQuery({ name: 'startTime', required: false, description: 'Start timestamp (Unix milliseconds)', example: 1609459200000 })
  @ApiQuery({ name: 'endTime', required: false, description: 'End timestamp (Unix milliseconds)', example: 1609545600000 })
  @ApiResponse({ 
    status: 200, 
    description: 'Market history retrieved successfully from Binance',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { 
          type: 'array',
          items: { $ref: '#/components/schemas/OHLCVDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters or Binance API error' })
  async getHistoryFromBinance(@Query() query: MarketHistoryDto): Promise<TBaseDTO<OHLCVDto[]>> {
    try {
      const data = await this.marketService.getHistoryFromBinance(query);
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch market history from Binance');
    }
  }

  /**
   * Get supported trading symbols
   * @returns Supported trading symbols response
   */
  @Get('symbols')
  @ApiOperation({ summary: 'Get supported trading symbols', description: 'Get list of all supported trading symbols in the system' })
  @ApiResponse({
    status: 200,
    description: 'Supported symbols retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { type: 'string' },
          example: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  async getSupportedSymbols(): Promise<TBaseDTO<string[]>> {
    try {
      const data = await this.marketService.getSupportedSymbols();
      return TBaseDTO.success(data);
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to fetch supported symbols');
    }
  }

  /**
   * Get real-time price
   * @param symbol - Trading symbol
   * @returns Real-time price response
   */
  @Get('realtime')
  @ApiOperation({ summary: 'Get real-time price', description: 'Get the latest price for a trading symbol' })
  @ApiQuery({ name: 'symbol', required: true, description: 'Trading symbol (e.g., BTCUSDT)', example: 'BTCUSDT' })
  @ApiResponse({
    status: 200,
    description: 'Real-time price retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/RealtimePriceDto' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Price data not found for symbol' })
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

