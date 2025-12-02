/**
 * News article DTO
 */
export class NewsDto {
  id!: number;
  title!: string;
  summary?: string;
  fullText!: string;
  tickers!: string[];
  source!: string;
  publishTime!: Date;
  url!: string;
  createdAt!: Date;
}

/**
 * News list response
 */
export class NewsListDto {
  news!: NewsDto[];
  total!: number;
  page!: number;
  limit!: number;
}

