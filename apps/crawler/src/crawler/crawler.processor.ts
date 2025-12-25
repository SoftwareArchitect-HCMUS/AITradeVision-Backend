import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { ExtractionService } from './extraction/extraction.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';

interface CrawlJobData {
  source: string;
  url: string;
}

/**
 * BullMQ processor for crawl jobs
 */
@Processor('crawl-news')
export class CrawlerProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlerProcessor.name);

  constructor(
    private crawlerService: CrawlerService,
    private extractionService: ExtractionService,
  ) {
    super();
  }

  /**
   * Process crawl job
   * @param job - BullMQ job
   */
  async process(job: Job<CrawlJobData>): Promise<void> {
    const { source, url } = job.data;
    this.logger.log(`Processing crawl job for ${source}: ${url}`);

    try {
      // Fetch the page with improved headers and error handling
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
        validateStatus: (status) => status < 500, // Accept 4xx but not 5xx
        // Handle SSL certificate issues for some sites
        httpsAgent: new https.Agent({
          rejectUnauthorized: !url.includes('cryptonews.io'), // Allow expired cert for cryptonews.io
        }),
        // Note: maxHeaderSize is set via Node.js --max-http-header-size flag
        // For Yahoo Finance header overflow, consider increasing Node.js max header size
      });

      const $ = cheerio.load(response.data);
      const articleLinks = this.extractArticleLinks($, source, url);

      this.logger.log(`Found ${articleLinks.length} articles from ${source}`);

      // Process each article
      for (const articleUrl of articleLinks.slice(0, 10)) { // Limit to 10 articles per crawl
        try {
          await this.crawlerService.processArticle(articleUrl, source);
          // Small delay to avoid overwhelming servers
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.error(`Error processing article ${articleUrl}:`, error);
        }
      }
    } catch (error: any) {
      // Handle specific errors gracefully
      if (error.response?.status === 401) {
        this.logger.warn(`⚠️ ${source} blocked request (401 Unauthorized) - website may have bot protection. Consider using proxy or headless browser.`);
        // Don't throw, just log and skip this source
        return;
      }
      
      if (error.code === 'CERT_HAS_EXPIRED' || error.message?.includes('certificate has expired')) {
        this.logger.warn(`⚠️ ${source} has expired SSL certificate - skipping for now`);
        return;
      }
      
      if (error.code === 'ECONNRESET' || error.message?.includes('socket disconnected')) {
        this.logger.warn(`⚠️ ${source} connection reset - may be rate limited or firewall blocked`);
        return;
      }
      
      if (error.message?.includes('Header overflow') || error.message?.includes('Parse Error')) {
        this.logger.warn(`⚠️ ${source} response headers too large - may need different approach`);
        return;
      }
      
      this.logger.error(`Error crawling ${source}:`, error);
      // Don't throw for non-critical errors, just log and continue
      // throw error;
    }
  }

  /**
   * Extract article links from page based on source
   * @param $ - Cheerio instance
   * @param source - News source
   * @param baseUrl - Base URL for resolving relative links
   * @returns Array of article URLs
   */
  private extractArticleLinks($: cheerio.CheerioAPI, source: string, baseUrl: string): string[] {
    const links: string[] = [];
    const urlObj = new URL(baseUrl);

    // Source-specific selectors
    const selectors: Record<string, string[]> = {
      bloomberg: ['a[data-module="Article"]', 'a.story-list-story__info__headline'],
      reuters: ['a[data-testid="Link"]', 'article a'],
      cointelegraph: ['a.post-card-inline__title-link', 'article a'],
      'yahoo-finance': ['a[data-module="Article"]', 'h3 a'],
      investing: ['a.articleItem', 'article a.title'],
      'cnbc-crypto': ['a.Card-title', 'article a'],
    };

    const sourceSelectors = selectors[source] || ['article a', 'a[href*="/news/"]'];

    for (const selector of sourceSelectors) {
      $(selector).each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).href;
            if (absoluteUrl.includes(urlObj.hostname) && !links.includes(absoluteUrl)) {
              links.push(absoluteUrl);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      });
    }

    return links;
  }
}

