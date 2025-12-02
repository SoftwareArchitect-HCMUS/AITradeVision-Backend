import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ExtractionStrategy } from './extraction-strategy.interface';
import { ExtractedContent } from '../extraction/extraction.service';

/**
 * Reuters-specific extraction strategy
 */
@Injectable()
export class ReutersStrategy implements ExtractionStrategy {
  extractWithSelector($: cheerio.CheerioAPI, url: string): ExtractedContent | null {
    const title = $('h1[data-testid="Text"]').text().trim() ||
                  $('article h1').text().trim();

    const summary = $('[data-testid="ArticleBody"] p').first().text().trim();

    const paragraphs = $('[data-testid="ArticleBody"] p').toArray();
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
                    $('[data-testid="Timestamp"]').attr('datetime');
    if (timeStr) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return undefined;
  }
}

