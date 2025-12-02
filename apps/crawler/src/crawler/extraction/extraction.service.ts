import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BloombergStrategy } from '../strategies/bloomberg.strategy';
import { ReutersStrategy } from '../strategies/reuters.strategy';
import { CointelegraphStrategy } from '../strategies/cointelegraph.strategy';
import { YahooFinanceStrategy } from '../strategies/yahoo-finance.strategy';
import { InvestingStrategy } from '../strategies/investing.strategy';
import { CNBCCryptoStrategy } from '../strategies/cnbc-crypto.strategy';
import { GenericStrategy } from '../strategies/generic.strategy';
import { ExtractionStrategy } from '../strategies/extraction-strategy.interface';

export interface ExtractedContentBase {
  title: string;
  summary?: string;
  fullText: string;
  publishTime?: Date;
}

export interface ExtractedContent extends ExtractedContentBase {
  rawHTML: string; // Always set by extraction service
}

/**
 * Service for extracting content from news articles using multiple strategies
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private strategies: Map<string, ExtractionStrategy> = new Map();

  constructor(
    private bloombergStrategy: BloombergStrategy,
    private reutersStrategy: ReutersStrategy,
    private cointelegraphStrategy: CointelegraphStrategy,
    private yahooFinanceStrategy: YahooFinanceStrategy,
    private investingStrategy: InvestingStrategy,
    private cnbcCryptoStrategy: CNBCCryptoStrategy,
    private genericStrategy: GenericStrategy,
  ) {
    // Register strategies
    this.strategies.set('bloomberg', this.bloombergStrategy);
    this.strategies.set('reuters', this.reutersStrategy);
    this.strategies.set('cointelegraph', this.cointelegraphStrategy);
    this.strategies.set('yahoo-finance', this.yahooFinanceStrategy);
    this.strategies.set('investing', this.investingStrategy);
    this.strategies.set('cnbc-crypto', this.cnbcCryptoStrategy);
  }

  /**
   * Extract content from a URL using appropriate strategy
   * @param url - Article URL
   * @param source - News source name
   * @returns Extracted content or null if extraction fails
   */
  async extract(url: string, source: string): Promise<ExtractedContent | null> {
    try {
      // Fetch HTML
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Try source-specific strategy first
      const strategy = this.strategies.get(source) || this.genericStrategy;

      // Strategy 1: CSS Selector (primary)
      let extracted = strategy.extractWithSelector($, url);

      // Strategy 2: XPath fallback if CSS fails
      if (!extracted || !extracted.fullText) {
        extracted = strategy.extractWithXPath($, url);
      }

      // Strategy 3: Generic readability-like algorithm
      if (!extracted || !extracted.fullText) {
        extracted = this.genericStrategy.extractGeneric($, url);
      }

      if (!extracted || !extracted.fullText) {
        this.logger.warn(`Failed to extract content from: ${url}`);
        return null;
      }

      // Add rawHTML to create ExtractedContent
      const result: ExtractedContent = {
        ...extracted,
        rawHTML: html,
      };
      return result;
    } catch (error) {
      this.logger.error(`Error extracting from ${url}:`, error);
      return null;
    }
  }
}

