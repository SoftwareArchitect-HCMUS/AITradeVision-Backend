import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { GroqService } from '../../groq/groq.service';
import { ExtractionTemplate } from './template.service';
import { ExtractionStrategy } from '../strategies/extraction-strategy.interface';

/**
 * Service for generating extraction templates using AI (Groq)
 */
@Injectable()
export class TemplateGeneratorService {
  private readonly logger = new Logger(TemplateGeneratorService.name);

  constructor(private groqService: GroqService) {}

  /**
   * Generate extraction template from HTML using AI
   * @param source - News source name
   * @param html - Raw HTML content
   * @param url - Article URL
   * @param referenceStrategy - Optional reference strategy for hints
   * @returns Generated template or null if generation fails
   */
  async generateTemplate(
    source: string,
    html: string,
    url: string,
    referenceStrategy?: ExtractionStrategy,
  ): Promise<ExtractionTemplate | null> {
    if (!this.groqService.isEnabled()) {
      this.logger.warn('Groq not enabled, cannot generate template');
      return null;
    }

    // Validate URL is an article page (not category/home page)
    if (!this.isArticlePage(url, source)) {
      this.logger.warn(`URL ${url} does not appear to be an article page, skipping template generation`);
      return null;
    }

    try {
      // Extract sample HTML structure for analysis
      const $ = cheerio.load(html);
      const sampleStructure = this.extractSampleStructure($);

      // Build reference hints from manual strategy if available
      let referenceHints = '';
      if (referenceStrategy) {
        referenceHints = this.getReferenceHints(source);
      }

      const prompt = `
You are an expert web scraping analyst specializing in news article extraction. Analyze the HTML structure and generate PRECISE CSS selectors.

IMPORTANT: This is an ARTICLE PAGE (not category/home page). Extract selectors that work specifically for article pages.

Source: ${source}
URL: ${url}

${referenceHints ? `Reference selectors for ${source} (use as hints, but verify against actual HTML):\n${referenceHints}\n` : ''}

HTML Structure Sample:
${sampleStructure}

Full HTML (first 10000 characters):
${html.substring(0, 10000)}

CRITICAL REQUIREMENTS:
1. Title selector: Must extract the ARTICLE TITLE (not page title like "Latest News | Site Name")
   - Avoid: "title" tag (usually page title, not article title)
   - Prefer: Specific article title classes (e.g., ".post__title", "h1.article-title")
   - Must return meaningful text (>10 chars, no "|" or " - " separators)

2. Content selector: Must extract MAIN ARTICLE BODY TEXT
   - Must contain multiple paragraphs (<p> tags)
   - Should exclude: nav, footer, ads, sidebars, social share buttons
   - Must return substantial content (>200 chars)
   - Prefer selectors that target article body containers

3. Summary selector: Extract article lead/summary if available
   - Usually first paragraph or dedicated summary element

4. Publish time selector: Extract article publish date
   - Look for <time datetime=""> or date elements

Return ONLY a JSON object in this exact format:
{
  "titleSelector": "CSS selectors separated by commas, most specific first (e.g., '.post__title, h1.post__title, article h1, h1')",
  "summarySelector": "CSS selectors for summary (e.g., '.post__lead, .article-lead, article > p:first-of-type') or empty string",
  "contentSelector": "CSS selectors for main content (e.g., '.post__text, .post-content, article .content, article')",
  "publishTimeSelector": "CSS selectors for publish time (e.g., 'time[datetime], .post__date, [itemprop=\"datePublished\"]') or empty string",
  "xpathTitle": "XPath for title (e.g., '//h1')",
  "xpathContent": "XPath for content (e.g., '//article//p')"
}

Rules:
- Provide multiple CSS selectors separated by commas (fallback options, most specific first)
- Selectors MUST be specific enough to avoid navigation/ads
- Title selector MUST NOT be just "title" tag (use article-specific selectors)
- Content selector MUST target elements with <p> tags (article paragraphs)
- Test your selectors mentally: would they extract article content, not page navigation?
- If unsure, use empty string "" for optional fields
- Do not include any other text, only the JSON object
`;

      // Call Groq API using GroqService's public method
      const content = await this.groqService.generateText(
        prompt,
        'You are a web scraping expert. Return only valid JSON.',
        500,
      );

      if (!content) {
        this.logger.warn('Groq returned empty response for template generation');
        return null;
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Failed to extract JSON from Groq response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.titleSelector || !parsed.contentSelector) {
        this.logger.warn('Generated template missing required selectors');
        return null;
      }

      // Validate and clean selectors
      const titleSelector = this.validateAndCleanSelector(parsed.titleSelector, 'title');
      const contentSelector = this.validateAndCleanSelector(parsed.contentSelector, 'content');

      if (!titleSelector || !contentSelector) {
        this.logger.warn('Generated template has invalid selectors');
        return null;
      }

      // Test template with actual HTML to ensure it works
      const isValid = await this.validateTemplate($, {
        titleSelector,
        contentSelector: contentSelector,
      });

      if (!isValid) {
        this.logger.warn('Generated template failed validation test');
        return null;
      }

      const template: ExtractionTemplate = {
        source,
        version: 1, // Will be set by TemplateService.regenerateTemplate
        titleSelector,
        summarySelector: this.validateAndCleanSelector(parsed.summarySelector || '', 'summary') || '',
        contentSelector,
        publishTimeSelector: this.validateAndCleanSelector(parsed.publishTimeSelector || '', 'publishTime') || '',
        xpathTitle: parsed.xpathTitle || '',
        xpathContent: parsed.xpathContent || '',
        isActive: true,
        successCount: 0,
        failCount: 0,
      };

      this.logger.log(`✅ Generated and validated template for ${source}`);
      return template;
    } catch (error) {
      this.logger.error(`Error generating template for ${source}:`, error);
      return null;
    }
  }

  /**
   * Check if URL is an article page (not category/home page)
   * @param url - URL to check
   * @param source - News source name
   * @returns true if URL appears to be an article page
   */
  private isArticlePage(url: string, source: string): boolean {
    // Article page patterns
    const articlePatterns: Record<string, RegExp[]> = {
      cointelegraph: [
        /\/news\//,
        /\/markets\//,
        /\/analysis\//,
        /\/press-releases\//,
      ],
      bloomberg: [
        /\/articles\//,
        /\/news\//,
      ],
      reuters: [
        /\/article\//,
        /\/breakingviews\//,
      ],
      'cnbc-crypto': [
        /\/202\d\//, // Date-based URLs
        /\/crypto\//,
      ],
    };

    const patterns = articlePatterns[source] || [/\/news\//, /\/article\//, /\/\d{4}\//];
    
    // Check if URL matches article patterns
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    // Exclude category/home pages
    const excludePatterns = [
      /\/category\//,
      /\/tag\//,
      /\/author\//,
      /\/$/, // Home page
      /\/latest-news/,
      /\/archive\//,
    ];

    for (const pattern of excludePatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }

    // Default: assume it's an article if URL has path segments
    return url.split('/').length > 4;
  }

  /**
   * Extract sample HTML structure for analysis
   * @param $ - Cheerio instance
   * @returns Sample structure string
   */
  private extractSampleStructure($: cheerio.CheerioAPI): string {
    const structure: string[] = [];

    // Sample title elements
    const titleElements = $('h1, .post__title, .article-title, [itemprop="headline"]').slice(0, 3);
    titleElements.each((_, el) => {
      const tag = $(el).prop('tagName')?.toLowerCase() || 'unknown';
      const classes = $(el).attr('class') || '';
      const text = $(el).text().trim().substring(0, 50);
      structure.push(`Title candidate: <${tag} class="${classes}">${text}...</${tag}>`);
    });

    // Sample content containers
    const contentElements = $('article, .post__text, .post-content, .article-content, [itemprop="articleBody"]').slice(0, 3);
    contentElements.each((_, el) => {
      const tag = $(el).prop('tagName')?.toLowerCase() || 'unknown';
      const classes = $(el).attr('class') || '';
      const paragraphCount = $(el).find('p').length;
      structure.push(`Content candidate: <${tag} class="${classes}"> (${paragraphCount} paragraphs)`);
    });

    return structure.join('\n') || 'No obvious article structure found';
  }

  /**
   * Get reference hints from known manual strategies
   * @param source - News source name
   * @returns Reference hints string
   */
  private getReferenceHints(source: string): string {
    const hints: Record<string, string> = {
      cointelegraph: `
Known working selectors for Cointelegraph:
- Title: .post__title, h1.post__title, article h1
- Content: .post__text, .post-content (extract <p> tags inside)
- Summary: .post__lead, .article-lead
- Publish time: time[datetime], .post__date
Note: Cointelegraph uses BEM naming (double underscores: __)
`,
      bloomberg: `
Known working selectors for Bloomberg:
- Title: [data-module="Article"] h1, h1
- Content: [data-module="Article"] .body-copy, .article-body
- Summary: .article-summary, [data-module="Article"] .summary
`,
      reuters: `
Known working selectors for Reuters:
- Title: article h1, h1, [data-testid="Heading"]
- Content: article .article-body__content, [data-testid="ArticleBody"]
`,
      'cnbc-crypto': `
Known working selectors for CNBC Crypto:
- Title: h1.ArticleHeader-headline, h1
- Content: .ArticleBody-articleBody p (extract paragraphs)
- Summary: .ArticleHeader-description
`,
    };

    return hints[source] || '';
  }

  /**
   * Validate and clean CSS selector string
   * @param selector - Selector string
   * @param type - Selector type (for logging)
   * @returns Cleaned selector or null if invalid
   */
  private validateAndCleanSelector(selector: string, type: string): string | null {
    if (!selector || typeof selector !== 'string') {
      return null;
    }

    // Remove "title" tag from title selector (too generic, usually page title)
    if (type === 'title') {
      const selectors = selector.split(',').map(s => s.trim());
      const filtered = selectors.filter(s => s.toLowerCase() !== 'title');
      if (filtered.length === 0) {
        this.logger.warn('Title selector only contains "title" tag, which is too generic');
        return null;
      }
      return filtered.join(', ');
    }

    return selector.trim() || null;
  }

  /**
   * Validate template by testing selectors on actual HTML
   * @param $ - Cheerio instance
   * @param template - Template to validate
   * @returns true if template appears valid
   */
  private async validateTemplate(
    $: cheerio.CheerioAPI,
    template: { titleSelector: string; contentSelector: string },
  ): Promise<boolean> {
    try {
      // Test title selector
      const titleSelectors = template.titleSelector.split(',').map(s => s.trim());
      let titleFound = false;
      for (const selector of titleSelectors) {
        try {
          const element = $(selector).first();
          if (element.length) {
            const text = element.text().trim();
            if (text.length > 10 && !text.includes('|') && !text.includes(' - ')) {
              titleFound = true;
              break;
            }
          }
        } catch {
          // Invalid selector, continue
        }
      }

      // Test content selector
      const contentSelectors = template.contentSelector.split(',').map(s => s.trim());
      let contentFound = false;
      for (const selector of contentSelectors) {
        try {
          const element = $(selector).first();
          if (element.length) {
            const paragraphs = element.find('p').toArray();
            if (paragraphs.length >= 3) {
              // At least 3 paragraphs = likely article content
              contentFound = true;
              break;
            }
          }
        } catch {
          // Invalid selector, continue
        }
      }

      if (!titleFound) {
        this.logger.debug(`Template validation failed: title selector "${template.titleSelector}" did not find valid title`);
      }
      if (!contentFound) {
        this.logger.debug(`Template validation failed: content selector "${template.contentSelector}" did not find valid content`);
      }

      return titleFound && contentFound;
    } catch (error) {
      this.logger.error('Error validating template:', error);
      return false;
    }
  }
}

