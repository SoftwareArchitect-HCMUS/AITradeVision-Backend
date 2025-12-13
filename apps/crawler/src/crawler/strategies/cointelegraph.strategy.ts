import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ExtractionStrategy } from './extraction-strategy.interface';
import { ExtractedContentBase } from '../extraction/extraction.service';

/**
 * Cointelegraph-specific extraction strategy
 */
@Injectable()
export class CointelegraphStrategy implements ExtractionStrategy {
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null {
    // Try multiple title selectors (handle structure changes)
    const titleSelectors = [
      '.post__title',
      'h1.post__title',
      'article h1',
      'h1',
      '[itemprop="headline"]',
      '.article-title',
    ];

    let title = '';
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length) {
        title = element.text().trim();
        if (title.length > 10) { // Valid title should be meaningful
          break;
        }
      }
    }

    // Try multiple summary selectors
    const summarySelectors = [
      '.post__lead',
      '.article-lead',
      '.summary',
      'article > p:first-of-type',
      '[itemprop="description"]',
    ];

    let summary = '';
    for (const selector of summarySelectors) {
      const element = $(selector).first();
      if (element.length) {
        summary = element.text().trim();
        if (summary.length > 20) {
          break;
        }
      }
    }

    // Try multiple content selectors
    const contentSelectors = [
      '.post__text',
      '.post-content',
      '.article-content',
      'article .content',
      '[itemprop="articleBody"]',
      'article',
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // Remove unwanted elements
        element.find('script, style, nav, footer, aside, .ad, .advertisement, .social-share').remove();
        const paragraphs = element.find('p').toArray();
        if (paragraphs.length > 0) {
          content = paragraphs.map(p => $(p).text().trim()).filter(t => t.length > 20).join('\n\n');
          if (content.length > 200) { // Valid content should be substantial
            break;
          }
        }
      }
    }

    if (!title || !content) {
      return null;
    }

    return {
      title,
      summary: summary || undefined,
      fullText: content,
      publishTime: this.extractPublishTime($),
    };
  }

  extractWithXPath($: cheerio.CheerioAPI, url: string): ExtractedContentBase | null {
    return this.extractWithSelector($, url);
  }

  private extractPublishTime($: cheerio.CheerioAPI): Date | undefined {
    const timeStr = $('time[datetime]').attr('datetime') ||
                    $('.post__date').attr('datetime');
    if (timeStr) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return undefined;
  }
}

