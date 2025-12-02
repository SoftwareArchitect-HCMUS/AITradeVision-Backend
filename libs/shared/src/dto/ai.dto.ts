import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * DTO for AI insights query
 */
export class AIInsightsDto {
  @IsString()
  @IsOptional()
  symbol?: string;
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

