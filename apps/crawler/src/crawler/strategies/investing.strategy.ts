import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ExtractionStrategy } from './extraction-strategy.interface';
import { ExtractedContent } from '../extraction/extraction.service';

/**
 * Investing.com-specific extraction strategy
 */
@Injectable()
export class InvestingStrategy implements ExtractionStrategy {
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContent | null {
    const title = $('h1.articleHeader').text().trim() ||
                  $('article h1').text().trim();

    const summary = $('.articleSummary').text().trim();

    const paragraphs = $('.articlePage p').toArray();
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
                    $('.articleDate').attr('datetime');
    if (timeStr) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return undefined;
  }
}

