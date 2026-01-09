import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsEntity } from '../database/entities/news.entity';
import { RedisService } from '../redis/redis.service';
import { ExtractionService } from './extraction/extraction.service';
import { GroqService } from '../groq/groq.service';
import { REDIS_CHANNELS } from '@shared/core';

/**
 * Crawler service for scheduling and managing news crawling tasks
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly CRAWL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectQueue('crawl-news') private crawlQueue: Queue,
    @InjectRepository(NewsEntity) private newsRepository: Repository<NewsEntity>,
    private redisService: RedisService,
    private extractionService: ExtractionService,
    private groqService: GroqService,
  ) {}

  /**
   * Initialize scheduled crawling tasks
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing crawler service');
    
    // Schedule initial crawl
    await this.scheduleCrawl();
    
    // Schedule periodic crawls
    setInterval(() => {
      this.scheduleCrawl();
    }, this.CRAWL_INTERVAL_MS);
  }

  /**
   * Schedule crawl jobs for all sources
   */
  private async scheduleCrawl(): Promise<void> {
    // Removed problematic sources:
    // - yahoo-finance: Header overflow (Node.js HTTP parser limitation)
    // - investing: Connection reset (firewall/rate limiting)
    // - crypto-news.io: SSL certificate expired
    const sources = [
      { name: 'bloomberg', url: 'https://www.bloomberg.com/crypto' },
      { name: 'reuters', url: 'https://www.reuters.com/finance/cryptocurrency' },
      { name: 'cointelegraph', url: 'https://cointelegraph.com' },
      { name: 'cnbc-crypto', url: 'https://www.cnbc.com/cryptocurrency' },
    ];

    for (const source of sources) {
      await this.crawlQueue.add('crawl-source', {
        source: source.name,
        url: source.url,
      }, {
        // Override default options for this specific job
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 50, // Keep max 50
        },
        removeOnFail: {
          age: 86400, // 24 hours
          count: 20, // Keep max 20
        },
      });
    }

    this.logger.log(`Scheduled ${sources.length} crawl jobs`);
  }

  /**
   * Process a single article URL
   * @param url - Article URL
   * @param source - News source name
   */
  async processArticle(url: string, source: string): Promise<void> {
    try {
      // Check if article already exists
      const existing = await this.newsRepository.findOne({
        where: { url },
      });

      if (existing) {
        this.logger.debug(`Article already exists: ${url}`);
        return;
      }

      // Extract article content
      const extracted = await this.extractionService.extract(url, source);

      if (!extracted) {
        this.logger.warn(`Failed to extract content from: ${url}`);
        return;
      }

      // Extract tickers from content (with AI fallback)
      this.logger.log(`Extracting tickers for article: ${extracted.title.substring(0, 60)}...`);
      let tickers = this.extractTickers(extracted.title + ' ' + extracted.fullText);
      
      // If no tickers found with regex/keyword, try AI extraction (Groq)
      if (tickers.length === 0) {
        this.logger.log(`No tickers found with regex/patterns, trying Groq AI extraction for: ${extracted.title.substring(0, 60)}...`);
        const aiTickers = await this.groqService.extractTickers(extracted.title, extracted.fullText);
        if (aiTickers.length > 0) {
          tickers = aiTickers;
          this.logger.log(`✅ Groq AI extracted ${tickers.length} ticker(s): ${tickers.join(', ')}`);
        } else {
          this.logger.warn(`⚠️ No tickers found (regex and Groq AI both failed) for: ${extracted.title.substring(0, 60)}...`);
        }
      } else {
        this.logger.log(`✅ Extracted ${tickers.length} ticker(s) with regex/patterns: ${tickers.join(', ')}`);
      }

      // Save to database
      const news = this.newsRepository.create({
        title: extracted.title,
        summary: extracted.summary,
        fullText: extracted.fullText,
        tickers,
        source,
        publishTime: extracted.publishTime || new Date(),
        url,
      });

      const savedNews = await this.newsRepository.save(news);

      // Publish event
      await this.redisService.publishNewsCreated({
        newsId: savedNews.id,
        title: savedNews.title,
        tickers: savedNews.tickers,
        publishTime: savedNews.publishTime,
        source: savedNews.source,
      });

      this.logger.log(`Processed article: ${savedNews.title}`);
    } catch (error) {
      this.logger.error(`Error processing article ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract cryptocurrency tickers from text
   * @param text - Text to analyze
   * @returns Array of ticker symbols
   */
  private extractTickers(text: string): string[] {
    const tickers = new Set<string>();
    const upperText = text.toUpperCase();

    // Common cryptocurrency tickers (expanded list)
    const commonTickers = [
      'BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX',
      'LINK', 'UNI', 'LTC', 'ATOM', 'ETC', 'XLM', 'ALGO', 'VET', 'ICP', 'FIL',
      'TRX', 'NEAR', 'APT', 'OP', 'ARB', 'INJ', 'TIA', 'SUI', 'SEI', 'WLD',
      'PEPE', 'SHIB', 'FLOKI', 'BONK', 'FET', 'RENDER', 'RUNE', 'THETA', 'FTM',
      'SAND', 'MANA', 'AXS', 'ENJ', 'GALA', 'CHZ', 'FLOW', 'IMX', 'GMT', 'APE',
    ];

    // Map coin names to tickers
    const coinNameMap: Record<string, string> = {
      'BITCOIN': 'BTC',
      'ETHEREUM': 'ETH',
      'SOLANA': 'SOL',
      'BINANCE COIN': 'BNB',
      'CARDANO': 'ADA',
      'RIPPLE': 'XRP',
      'DOGECOIN': 'DOGE',
      'POLKADOT': 'DOT',
      'POLYGON': 'MATIC',
      'AVALANCHE': 'AVAX',
      'CHAINLINK': 'LINK',
      'UNISWAP': 'UNI',
      'LITECOIN': 'LTC',
      'COSMOS': 'ATOM',
      'ETHEREUM CLASSIC': 'ETC',
      'STELLAR': 'XLM',
      'ALGORAND': 'ALGO',
      'VECHAIN': 'VET',
      'INTERNET COMPUTER': 'ICP',
      'FILECOIN': 'FIL',
      'TRON': 'TRX',
      'NEAR PROTOCOL': 'NEAR',
      'APTOS': 'APT',
      'OPTIMISM': 'OP',
      'ARBITRUM': 'ARB',
      'INJECTIVE': 'INJ',
      'CELESTIA': 'TIA',
      'SUI': 'SUI',
      'SEI': 'SEI',
      'WORLDCOIN': 'WLD',
      'PEPE': 'PEPE',
      'SHIBA INU': 'SHIB',
      'FLOKI': 'FLOKI',
      'BONK': 'BONK',
      'FETCH.AI': 'FET',
      'RENDER': 'RENDER',
      'THORCHAIN': 'RUNE',
      'THETA': 'THETA',
      'FANTOM': 'FTM',
      'SAND': 'SAND',
      'DECENTRALAND': 'MANA',
      'AXIE INFINITY': 'AXS',
      'ENJIN': 'ENJ',
      'GALA': 'GALA',
      'CHILIZ': 'CHZ',
      'FLOW': 'FLOW',
      'IMMUTABLE X': 'IMX',
      'STEPN': 'GMT',
      'APECOIN': 'APE',
    };

    // Pattern 1: Match ticker pairs (BTCUSDT, ETH/USD, BTC-USDT, etc.)
    const pairPattern = /\b([A-Z]{2,10})(?:USDT|USD|EUR|GBP|JPY|\/USDT|\/USD|\/EUR|\/GBP|\/JPY|-USDT|-USD)\b/gi;
    const pairMatches = text.match(pairPattern);
    if (pairMatches) {
      pairMatches.forEach(match => {
        // Extract base ticker (before USDT/USD/etc)
        const baseTicker = match.replace(/(?:USDT|USD|EUR|GBP|JPY|\/|-)/gi, '').toUpperCase();
        if (commonTickers.includes(baseTicker)) {
          tickers.add(baseTicker);
        }
      });
    }

    // Pattern 2: Match standalone tickers (BTC, ETH, etc.) - must be word boundaries
    for (const ticker of commonTickers) {
      // Match ticker as standalone word or followed by space/punctuation
      const standalonePattern = new RegExp(`\\b${ticker}\\b(?!USDT|USD|EUR|GBP|JPY)`, 'gi');
      if (standalonePattern.test(text)) {
        tickers.add(ticker);
      }
    }

    // Pattern 3: Match coin names and map to tickers
    for (const [coinName, ticker] of Object.entries(coinNameMap)) {
      const namePattern = new RegExp(`\\b${coinName.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      if (namePattern.test(text)) {
        tickers.add(ticker);
      }
    }

    // Convert to array and normalize to USDT pairs for consistency (e.g., BTC -> BTCUSDT)
    const result = Array.from(tickers)
      .map(t => {
        const upperTicker = t.toUpperCase();
        // If already ends with USDT/USD/etc, keep as is, otherwise add USDT
        if (upperTicker.endsWith('USDT') || upperTicker.endsWith('USD') || 
            upperTicker.endsWith('EUR') || upperTicker.endsWith('GBP') || 
            upperTicker.endsWith('JPY')) {
          return upperTicker;
        }
        return `${upperTicker}USDT`;
      })
      .filter((t, index, self) => self.indexOf(t) === index); // Remove duplicates
    
    // Logging is handled in processArticle method, so we don't log here to avoid duplicate logs

    return result;
  }
}

