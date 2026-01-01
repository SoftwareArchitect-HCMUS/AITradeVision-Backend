import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { ExtractionService } from './extraction/extraction.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import puppeteer, { Browser, Page } from 'puppeteer';

interface CrawlJobData {
  source: string;
  url: string;
}

/**
 * BullMQ processor for crawl jobs
 * Uses hybrid approach: Axios for server-rendered pages, Puppeteer for JavaScript-rendered (SPA)
 */
@Processor('crawl-news')
export class CrawlerProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlerProcessor.name);
  private browser: Browser | null = null;
  private browserInitPromise: Promise<void> | null = null;
  
  // Sources that require Puppeteer (JavaScript-rendered)
  private readonly SPA_SOURCES = ['bloomberg', 'reuters'];

  constructor(
    private crawlerService: CrawlerService,
    private extractionService: ExtractionService,
  ) {
    super();
  }

  /**
   * Initialize Puppeteer browser instance
   */
  async onModuleInit(): Promise<void> {
    // Initialize browser asynchronously (don't block module init)
    this.browserInitPromise = this.initBrowser();
  }

  /**
   * Initialize Puppeteer browser
   */
  private async initBrowser(): Promise<void> {
    try {
      // Cross-platform Chrome paths
      const os = require('os');
      const platform = os.platform();
      const fs = require('fs');
      
      let chromePaths: string[] = [];
      
      // Platform-specific Chrome paths
      if (platform === 'darwin') {
        // macOS
        chromePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ];
      } else if (platform === 'win32') {
        // Windows
        const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
        const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
        chromePaths = [
          `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
          `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
          `${programFiles}\\Chromium\\Application\\chromium.exe`,
        ];
      } else {
        // Linux
        chromePaths = [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium',
        ];
      }

      let executablePath: string | undefined;
      for (const path of chromePaths) {
        try {
          if (fs.existsSync(path)) {
            executablePath = path;
            this.logger.log(`Found Chrome at: ${path} (${platform})`);
            break;
          }
        } catch {
          // Ignore errors when checking paths
        }
      }

      const launchOptions: any = {
        headless: 'new', // Use new headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
        ],
      };

      // Use system Chrome if found, otherwise use Puppeteer's bundled Chrome
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.logger.log('Puppeteer browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer browser:', error);
      this.logger.warn('⚠️ Puppeteer unavailable - Bloomberg and Reuters will use Axios (may not work for JavaScript-rendered pages)');
      // Continue without Puppeteer - will use Axios only
      this.browser = null;
    }
  }

  /**
   * Wait for browser to be initialized (if needed)
   */
  private async ensureBrowserReady(): Promise<void> {
    if (this.browserInitPromise) {
      await this.browserInitPromise;
      this.browserInitPromise = null; // Clear promise after first wait
    }
  }

  /**
   * Cleanup Puppeteer browser instance
   */
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Puppeteer browser closed');
    }
  }

  /**
   * Process crawl job
   * @param job - BullMQ job
   */
  async process(job: Job<CrawlJobData>): Promise<void> {
    const { source, url } = job.data;
    this.logger.log(`Processing crawl job for ${source}: ${url}`);

    // Wait for browser to be ready if this source needs Puppeteer
    if (this.SPA_SOURCES.includes(source)) {
      await this.ensureBrowserReady();
    }

    // Retry logic for network errors
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let html: string;
        let $: cheerio.CheerioAPI;

        // Use Puppeteer for JavaScript-rendered pages (SPA), Axios for server-rendered
        const shouldUsePuppeteer = this.SPA_SOURCES.includes(source) && this.browser !== null;
        
        if (shouldUsePuppeteer) {
          this.logger.debug(`Using Puppeteer for ${source} (JavaScript-rendered page)`);
          html = await this.fetchWithPuppeteer(url);
          $ = cheerio.load(html);
        } else {
          // Use Axios for server-rendered pages (faster, less resource-intensive)
          if (this.SPA_SOURCES.includes(source) && !this.browser) {
            this.logger.warn(`⚠️ ${source} requires Puppeteer but browser not available - using Axios (may not work for SPA)`);
          } else {
            this.logger.debug(`Using Axios for ${source} (server-rendered page)`);
          }
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
            httpsAgent: new https.Agent({
              rejectUnauthorized: !url.includes('cryptonews.io'),
            }),
          });
          html = response.data;
          $ = cheerio.load(html);
        }

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

    // Source-specific selectors with extensive fallbacks
    const selectors: Record<string, string[]> = {
      bloomberg: [
        'a[data-module="Article"]',
        'a.story-list-story__info__headline',
        'a[href*="/articles/"]', // Bloomberg article URLs
        'a[href*="/news/"]',
        'article a[href*="/articles/"]',
        'article a[href*="/news/"]',
        'a.headline',
        'a.story-link',
        'h3 a',
        'h2 a',
        'a[data-track-label="Article"]',
        // More generic patterns
        'a[href*="/crypto/"]',
        '[data-module="Article"] a',
        '.story-list-story a',
      ],
      reuters: [
        'a[data-testid="Link"]',
        'article a',
        'a[href*="/article/"]', // Reuters article URLs
        'a[href*="/breakingviews/"]',
        'a[data-testid="Heading"]',
        'h3 a',
        'h2 a',
        'a.story-collection-module__story__headline',
        'a.media-story-card__headline__link',
        // More generic patterns
        'a[href*="/finance/cryptocurrency"]',
        '[data-testid="Link"]',
      ],
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

    // Debug: Log HTML structure for SPA sources
    if (this.SPA_SOURCES.includes(source)) {
      const bodyText = $('body').text().trim();
      const allLinks = $('a[href]').length;
      this.logger.debug(`${source}: Body text length: ${bodyText.length} chars, Total links: ${allLinks}`);
      
      // Log sample of all links to see what's available
      const sampleLinks = $('a[href]').slice(0, 20).map((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim().substring(0, 50);
        return { href, text };
      }).get();
      this.logger.debug(`${source}: Sample links (first 20): ${JSON.stringify(sampleLinks, null, 2)}`);
    }

    // Try source-specific selectors first
    for (const selector of sourceSelectors) {
      const count = $(selector).length;
      if (count > 0) {
        this.logger.debug(`${source}: Selector "${selector}" found ${count} elements`);
      }
      
      $(selector).each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).href;
            // Filter URLs based on source patterns
            if (source === 'bloomberg') {
              if (absoluteUrl.includes(urlObj.hostname) && 
                  !links.includes(absoluteUrl) &&
                  (absoluteUrl.includes('/articles/') || 
                   absoluteUrl.includes('/news/') ||
                   absoluteUrl.includes('/story/') ||
                   absoluteUrl.includes('/crypto/'))) {
                links.push(absoluteUrl);
              }
            } else if (source === 'reuters') {
              if (absoluteUrl.includes(urlObj.hostname) && 
                  !links.includes(absoluteUrl) &&
                  (absoluteUrl.includes('/business/finance/') || 
                   absoluteUrl.includes('/markets/quote/') ||
                   absoluteUrl.includes('/finance/cryptocurrency/'))) {
                links.push(absoluteUrl);
              }
            } else {
              if (absoluteUrl.includes(urlObj.hostname) && !links.includes(absoluteUrl)) {
                links.push(absoluteUrl);
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      });
    }

    // Fallback: Extract all article-like URLs if no links found
    if ((source === 'bloomberg' || source === 'reuters') && links.length === 0) {
      this.logger.warn(`⚠️ ${source}: No links found with selectors, trying fallback - extracting all article-like URLs...`);
      
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).href;
            if (source === 'bloomberg') {
              if (absoluteUrl.includes(urlObj.hostname) && 
                  !links.includes(absoluteUrl) &&
                  (absoluteUrl.includes('/articles/') || 
                   absoluteUrl.includes('/news/') ||
                   absoluteUrl.includes('/story/') ||
                   absoluteUrl.includes('/crypto/'))) {
                links.push(absoluteUrl);
              }
            } else if (source === 'reuters') {
              if (absoluteUrl.includes(urlObj.hostname) && 
                  !links.includes(absoluteUrl) &&
                  (absoluteUrl.includes('/business/finance/') || 
                   absoluteUrl.includes('/markets/quote/') ||
                   absoluteUrl.includes('/finance/cryptocurrency'))) {
                links.push(absoluteUrl);
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      });
      
      if (links.length > 0) {
        this.logger.log(`${source}: Found ${links.length} article links using fallback method`);
      } else {
        this.logger.warn(`⚠️ ${source}: Still no links found even with fallback method`);
      }
    }

    return links;
  }

  /**
   * Fetch page content using Puppeteer (for JavaScript-rendered pages)
   * @param url - URL to fetch
   * @returns HTML content
   */
  private async fetchWithPuppeteer(url: string): Promise<string> {
    if (!this.browser) {
      throw new Error('Puppeteer browser not initialized');
    }

    let page: Page | null = null;
    try {
      page = await this.browser.newPage();
      
      // Set viewport and user agent to mimic real browser
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set extra headers to avoid bot detection
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      // Navigate to page and wait for network to be idle
      await page.goto(url, {
        waitUntil: 'networkidle2', // Wait until network is idle (JS has finished loading)
        timeout: 60000,
      });

      // Wait for page to be fully loaded
      await page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 10000 }).catch(() => {
        // Ignore timeout, continue
      });

      // Scroll to trigger lazy loading
      await this.scrollPage(page);

      // Wait for content to load after scroll
      await page.waitForTimeout(3000);

      // Try to wait for article links to appear (for Bloomberg/Reuters)
      try {
        // Wait for any article-like elements
        await page.waitForSelector('a[href*="/article"], a[href*="/articles"], article a, [data-module="Article"]', {
          timeout: 5000,
        }).catch(() => {
          // Ignore if not found
        });
      } catch {
        // Ignore
      }

      // Wait a bit more for dynamic content
      await page.waitForTimeout(2000);

      // Get HTML content
      const html = await page.content();
      
      // Debug: Log page title and URL to verify we got the right page
      const pageTitle = await page.title();
      const pageUrl = page.url();
      this.logger.debug(`Puppeteer: Page title: "${pageTitle}", Final URL: ${pageUrl}`);
      
      return html;
    } catch (error) {
      this.logger.error(`Puppeteer fetch failed for ${url}:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Scroll page to trigger lazy loading
   * @param page - Puppeteer page instance
   */
  private async scrollPage(page: Page): Promise<void> {
    try {
      // Scroll to bottom to trigger lazy loading
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      
      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    } catch (error) {
      this.logger.warn('Error scrolling page:', error);
      // Continue even if scroll fails
    }
  }
}

