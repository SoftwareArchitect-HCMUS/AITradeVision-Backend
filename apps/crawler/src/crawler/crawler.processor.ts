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

    // Retry logic for network errors
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        
        // Success, break out of retry loop
        return;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry for these errors
        if (error.response?.status === 401) {
          this.logger.warn(`⚠️ ${source} blocked request (401 Unauthorized) - website may have bot protection`);
          return;
        }
        
        if (error.code === 'CERT_HAS_EXPIRED' || error.message?.includes('certificate has expired')) {
          this.logger.warn(`⚠️ ${source} has expired SSL certificate - skipping`);
          return;
        }
        
        if (error.message?.includes('Header overflow') || error.message?.includes('Parse Error')) {
          this.logger.warn(`⚠️ ${source} response headers too large - skipping`);
          return;
        }
        
        // Retry for network errors
        if (attempt < maxRetries - 1) {
          const delay = (attempt + 1) * 2000; // Exponential backoff: 2s, 4s, 6s
          this.logger.warn(`⚠️ ${source} request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // All retries failed
        this.logger.error(`Error crawling ${source} after ${maxRetries} attempts:`, error);
        return;
      }
    }
    
    // This should not be reached, but handle it just in case
    if (lastError) {
      this.logger.error(`Error crawling ${source}:`, lastError);
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
    // Removed yahoo-finance and investing selectors (sources removed)
    const selectors: Record<string, string[]> = {
      bloomberg: ['a[data-module="Article"]', 'a.story-list-story__info__headline'],
      reuters: ['a[data-testid="Link"]', 'article a'],
      cointelegraph: ['a.post-card-inline__title-link', 'article a'],
      'cnbc-crypto': [
        'a.Card-title',
        'a[data-module="Article"]',
        'article a',
        'a[href*="/cryptocurrency/"]',
        'h3 a',
        'a.ArticleCard-title',
      ],
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

