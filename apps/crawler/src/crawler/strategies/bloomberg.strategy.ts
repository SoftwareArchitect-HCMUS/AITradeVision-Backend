import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ExtractionStrategy } from './extraction-strategy.interface';
import { ExtractedContent } from '../extraction/extraction.service';

/**
 * Bloomberg-specific extraction strategy
 */
@Injectable()
export class BloombergStrategy implements ExtractionStrategy {
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContent | null {
    const title = $('h1').first().text().trim() || 
                  $('[data-module="Article"] h1').text().trim();

    const summary = $('.article-summary').text().trim() ||
                    $('[data-module="Article"] .summary').text().trim();

    const content = $('[data-module="Article"] .body-copy').text().trim() ||
                    $('.article-body').text().trim();

    if (!title || !content) {
      return null;
    }

    return {
      title,
      summary,
      fullText: content,
      publishTime: this.extractPublishTime($),
      rawHTML: $.html(),
    };
  }

  extractWithXPath($: cheerio.CheerioAPI, url: string): ExtractedContent | null {
    // Bloomberg-specific XPath fallback
    return this.extractWithSelector($, url);
  }

  private extractPublishTime($: cheerio.CheerioAPI): Date | undefined {
    const timeStr = $('time[datetime]').attr('datetime') ||
                    $('[data-module="Article"] time').attr('datetime');
    if (timeStr) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return undefined;
  }
}

