import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { ExtractionService } from './extraction/extraction.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
      // Fetch the page
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
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
    } catch (error) {
      this.logger.error(`Error crawling ${source}:`, error);
      throw error;
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

