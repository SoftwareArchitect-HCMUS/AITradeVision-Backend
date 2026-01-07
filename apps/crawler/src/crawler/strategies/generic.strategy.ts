import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ExtractionStrategy } from './extraction-strategy.interface';
import { ExtractedContentBase } from '../extraction/extraction.service';

/**
 * Generic extraction strategy using readability-like algorithm
 */
@Injectable()
export class GenericStrategy implements ExtractionStrategy {
  /**
   * Extract content using CSS selectors (generic)
   */
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null {
    // Try common article selectors
    const titleSelectors = [
      'h1',
      'article h1',
      '.article-title',
      '.post-title',
      '[itemprop="headline"]',
    ];

    const contentSelectors = [
      'article',
      '.article-content',
      '.post-content',
      '[itemprop="articleBody"]',
      '.entry-content',
      'main',
    ];

    let title = '';
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length) {
        title = element.text().trim();
        break;
      }
    }

    let fullText = '';
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // Remove script and style tags
        element.find('script, style, nav, footer, aside, .ad, .advertisement').remove();
        fullText = element.text().trim();
        if (fullText.length > 200) {
          break;
        }
      }
    }

    if (!title || !fullText) {
      return null;
    }

    return {
      title,
      fullText: this.cleanText(fullText),
      publishTime: this.extractPublishTime($),
    };
  }

  /**
   * Extract content using XPath (not implemented, uses generic fallback)
   */
  extractWithXPath($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null {
    // XPath is not directly supported in Cheerio, fallback to generic
    return this.extractGeneric($, url);
  }

  /**
   * Generic extraction using readability-like algorithm
   * @param $ - Cheerio instance
   * @param url - Article URL
   * @returns Extracted content or null
   */
  extractGeneric($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null {
    // Remove unwanted elements
    $('script, style, nav, footer, aside, .ad, .advertisement, .social-share').remove();

    // Find title
    const title = $('h1').first().text().trim() || 
                  $('title').text().trim() ||
                  '';

    // Find main content by analyzing paragraphs
    const paragraphs = $('p').toArray();
    let mainContent = '';

    for (const p of paragraphs) {
      const text = $(p).text().trim();
      if (text.length > 50) { // Filter out short paragraphs (likely navigation)
        mainContent += text + '\n\n';
      }
    }

    // If no paragraphs found, try divs
    if (mainContent.length < 200) {
      const divs = $('div').toArray();
      for (const div of divs) {
        const text = $(div).text().trim();
        if (text.length > 200 && !text.includes('cookie') && !text.includes('privacy')) {
          mainContent = text;
          break;
        }
      }
    }

    if (!title || mainContent.length < 100) {
      return null;
    }

    return {
      title,
      fullText: this.cleanText(mainContent),
      publishTime: this.extractPublishTime($),
    };
  }

  /**
   * Clean and normalize text while preserving line breaks
   * - Normalizes multiple newlines to double newlines
   * - Normalizes spaces/tabs within lines (but keeps single newlines)
   * - Trims leading/trailing whitespace
   * @param text - Raw text
   * @returns Cleaned text with preserved line breaks
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize Windows line endings
      .replace(/\r/g, '\n') // Normalize Mac line endings
      .replace(/\n{3,}/g, '\n\n') // Normalize 3+ newlines to double newlines
      .replace(/[ \t]+/g, ' ') // Normalize spaces/tabs within lines (keep \n)
      .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces before newlines
      .replace(/\n[ \t]+/g, '\n') // Remove leading spaces after newlines
      .trim();
  }

  /**
   * Extract publish time from page
   * @param $ - Cheerio instance
   * @returns Publish date or undefined
   */
  private extractPublishTime($: cheerio.CheerioAPI): Date | undefined {
    const timeSelectors = [
      'time[datetime]',
      '[itemprop="datePublished"]',
      '.publish-date',
      '.article-date',
    ];

    for (const selector of timeSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const datetime = element.attr('datetime') || element.text();
        if (datetime) {
          const date = new Date(datetime);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    return undefined;
  }
}

