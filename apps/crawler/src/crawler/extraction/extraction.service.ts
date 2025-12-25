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
    private groqService: GroqService,
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

      // Try source-specific strategy first
      const strategy = this.strategies.get(source) || this.genericStrategy;
      const strategyName = source !== 'generic' ? source : 'generic';

      // Strategy 1: CSS Selector (primary) - source-specific
      let extracted = strategy.extractWithSelector($, url);
      let usedStrategy = strategyName === 'generic' ? 'generic-selector' : `${strategyName}-selector`;

      // Strategy 2: XPath fallback if CSS fails (only for source-specific strategies)
      if ((!extracted || !extracted.fullText) && strategyName !== 'generic') {
        this.logger.debug(`CSS selector failed for ${source}, trying XPath fallback: ${url}`);
        extracted = strategy.extractWithXPath($, url);
        if (extracted && extracted.fullText) {
          usedStrategy = `${strategyName}-xpath`;
        }
      }

      // Strategy 3: Generic selector fallback (if source-specific failed)
      if ((!extracted || !extracted.fullText) && strategyName !== 'generic') {
        this.logger.debug(`Source-specific strategy failed for ${source}, trying generic selectors: ${url}`);
        extracted = this.genericStrategy.extractWithSelector($, url);
        if (extracted && extracted.fullText) {
          usedStrategy = 'generic-selector-fallback';
        }
      }

      // Strategy 4: Generic readability-like algorithm (last manual resort)
      if (!extracted || !extracted.fullText) {
        this.logger.debug(`All selector strategies failed, trying readability algorithm: ${url}`);
        extracted = this.genericStrategy.extractGeneric($, url);
        if (extracted && extracted.fullText) {
          usedStrategy = 'readability-algorithm';
        }
      }

      // Strategy 5: LLM-based extraction (Groq) as automatic adaptive fallback
      if ((!extracted || !extracted.fullText) && this.groqService.isEnabled()) {
        this.logger.debug(`Manual strategies failed, trying Groq LLM extraction: ${url}`);
        const aiExtracted = await this.groqService.extractFromHtml(url, html);
        if (aiExtracted && aiExtracted.fullText) {
          extracted = aiExtracted;
          usedStrategy = 'groq-llm';
        }
      }

      if (!extracted || !extracted.fullText) {
        this.logger.warn(`Failed to extract content from: ${url} (tried all strategies)`);
        return null;
      }

      // Log success with strategy used (for monitoring)
      if (usedStrategy.includes('readability') || usedStrategy.includes('generic-fallback')) {
        this.logger.warn(`Extracted using fallback strategy (${usedStrategy}) for ${source}: ${url} - website structure may have changed`);
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

