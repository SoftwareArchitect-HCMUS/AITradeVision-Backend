import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ExtractionStrategy } from './extraction-strategy.interface';
import { ExtractedContent } from '../extraction/extraction.service';

/**
 * Cointelegraph-specific extraction strategy
 */
@Injectable()
export class CointelegraphStrategy implements ExtractionStrategy {
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContent | null {
    const title = $('.post__title').text().trim() ||
                  $('h1').first().text().trim();

    const summary = $('.post__lead').text().trim();

    const paragraphs = $('.post__text').find('p').toArray();
    const content = paragraphs.map(p => $(p).text().trim()).join('\n\n');

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

