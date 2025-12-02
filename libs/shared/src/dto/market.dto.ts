import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

/**
 * Supported time intervals for market data
 */
export enum TimeInterval {
  ONE_SECOND = '1s',
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
}

/**
 * DTO for market history query
 */
export class MarketHistoryDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsEnum(TimeInterval)
  @IsNotEmpty()
  interval!: TimeInterval;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsOptional()
  limit?: number;
}

/**
 * OHLCV data point
 */
export class OHLCVDto {
  timestamp!: number;
  open!: number;
  high!: number;
  low!: number;
  close!: number;
  volume!: number;
}

/**
 * Real-time price data
 */
export class RealtimePriceDto {
  symbol!: string;
  price!: number;
  timestamp!: number;
  volume24h?: number;
  change24h?: number;
}

