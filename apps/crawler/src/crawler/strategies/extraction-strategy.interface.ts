import * as cheerio from 'cheerio';
import { ExtractedContentBase } from '../extraction/extraction.service';

/**
 * Interface for extraction strategies
 */
export interface ExtractionStrategy {
  /**
   * Extract content using CSS selectors
   * @param $ - Cheerio instance
   * @param url - Article URL
   * @returns Extracted content or null
   */
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null;

  /**
   * Extract content using XPath (fallback)
   * @param $ - Cheerio instance
   * @param url - Article URL
   * @returns Extracted content or null
   */
  extractWithXPath($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null;
}

