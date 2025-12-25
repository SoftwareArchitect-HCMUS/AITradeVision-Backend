import * as cheerio from 'cheerio';
import { ExtractedContentBase } from './extraction.service';
import { ExtractionStrategy } from '../strategies/extraction-strategy.interface';
import { GroqService } from '../../groq/groq.service';

/**
 * Context passed to extraction method strategies
 */
export interface ExtractionContext {
  $: cheerio.CheerioAPI;
  url: string;
  html: string;
  source: string;
  sourceStrategy: ExtractionStrategy;
  sourceStrategyName: string;
  genericStrategy: ExtractionStrategy;
  groqService: GroqService;
  usedStrategy?: string;
}

/**
 * Interface for extraction method strategies (Chain of Responsibility pattern)
 * Each method represents a different extraction technique with priority
 */
export interface ExtractionMethodStrategy {
  /**
   * Name of the extraction method
   */
  readonly name: string;

  /**
   * Priority order (lower number = higher priority, tried first)
   */
  readonly priority: number;

  /**
   * Check if this method can be executed for the given context
   * @param context - Extraction context
   * @returns true if method can be executed
   */
  canExecute(context: ExtractionContext): boolean;

  /**
   * Execute the extraction method
   * @param context - Extraction context
   * @returns Extracted content or null if extraction fails
   */
  execute(context: ExtractionContext): Promise<ExtractedContentBase | null>;
}

