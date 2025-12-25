import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import { BloombergStrategy } from '../strategies/bloomberg.strategy';
import { ReutersStrategy } from '../strategies/reuters.strategy';
import { CointelegraphStrategy } from '../strategies/cointelegraph.strategy';
import { YahooFinanceStrategy } from '../strategies/yahoo-finance.strategy';
import { InvestingStrategy } from '../strategies/investing.strategy';
import { CNBCCryptoStrategy } from '../strategies/cnbc-crypto.strategy';
import { GenericStrategy } from '../strategies/generic.strategy';
import { GroqService } from '../../groq/groq.service';
import { ExtractionStrategy } from '../strategies/extraction-strategy.interface';
import { ExtractionChain } from './extraction-chain';
import { ExtractionContext } from './extraction-method.interface';
import { CssSelectorMethod } from './methods/css-selector.method';
import { XPathMethod } from './methods/xpath.method';
import { GenericCssMethod } from './methods/generic-css.method';
import { ReadabilityMethod } from './methods/readability.method';
import { GroqLlmMethod } from './methods/groq-llm.method';

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
 * Uses Strategy Pattern + Chain of Responsibility for extraction methods
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private strategies: Map<string, ExtractionStrategy> = new Map();
  private extractionChain: ExtractionChain;

  constructor(
    private bloombergStrategy: BloombergStrategy,
    private reutersStrategy: ReutersStrategy,
    private cointelegraphStrategy: CointelegraphStrategy,
    private yahooFinanceStrategy: YahooFinanceStrategy,
    private investingStrategy: InvestingStrategy,
    private cnbcCryptoStrategy: CNBCCryptoStrategy,
    private genericStrategy: GenericStrategy,
    private groqService: GroqService,
  ) {
    // Register source-specific strategies
    this.strategies.set('bloomberg', this.bloombergStrategy);
    this.strategies.set('reuters', this.reutersStrategy);
    this.strategies.set('cointelegraph', this.cointelegraphStrategy);
    this.strategies.set('yahoo-finance', this.yahooFinanceStrategy);
    this.strategies.set('investing', this.investingStrategy);
    this.strategies.set('cnbc-crypto', this.cnbcCryptoStrategy);

    // Initialize extraction chain with all methods
    this.extractionChain = new ExtractionChain();
    this.extractionChain.addStrategy(new CssSelectorMethod());
    this.extractionChain.addStrategy(new XPathMethod());
    this.extractionChain.addStrategy(new GenericCssMethod());
    this.extractionChain.addStrategy(new ReadabilityMethod());
    this.extractionChain.addStrategy(new GroqLlmMethod());
  }

  /**
   * Extract content from a URL using appropriate strategy
   * @param url - Article URL
   * @param source - News source name
   * @returns Extracted content or null if extraction fails
   */
  async extract(url: string, source: string): Promise<ExtractedContent | null> {
    try {
      // Fetch HTML with improved headers and error handling
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        // Handle SSL certificate issues
        httpsAgent: new https.Agent({
          rejectUnauthorized: !url.includes('cryptonews.io'),
        }),
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Prepare extraction context
      const sourceStrategy = this.strategies.get(source) || this.genericStrategy;
      const sourceStrategyName = source !== 'generic' ? source : 'generic';

      const context: ExtractionContext = {
        $,
        url,
        html,
        source,
        sourceStrategy,
        sourceStrategyName,
        genericStrategy: this.genericStrategy,
        groqService: this.groqService,
      };

      // Execute extraction chain (tries all methods in priority order)
      const extracted = await this.extractionChain.execute(context);

      if (!extracted || !extracted.fullText) {
        this.logger.warn(`Failed to extract content from: ${url} (tried all strategies)`);
        return null;
      }

      // Log success with strategy used (for monitoring)
      const usedStrategy = context.usedStrategy || 'unknown';
      if (usedStrategy.includes('readability') || usedStrategy.includes('generic-fallback') || usedStrategy.includes('groq-llm')) {
        this.logger.warn(`Extracted using fallback strategy (${usedStrategy}) for ${source}: ${url} - website structure may have changed or required AI`);
      } else {
        this.logger.debug(`Successfully extracted using ${usedStrategy} for ${source}: ${url}`);
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

