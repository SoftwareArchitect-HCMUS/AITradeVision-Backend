import { IsString, IsOptional, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for AI insights query
 */
export class AIInsightsDto {
  @IsString()
  @IsOptional()
  symbol?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number;
}

/**
 * DTO for AI search query
 */
export class AISearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  limit?: number;
}

/**
 * AI insight response
 */
export class AIInsightDto {
  id!: number;
  newsId!: number;
  symbol!: string;
  sentiment!: 'positive' | 'negative' | 'neutral';
  summary!: string;
  reasoning!: string;
  prediction!: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence!: number;
  createdAt!: Date;
}

