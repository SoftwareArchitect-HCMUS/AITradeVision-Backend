import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from '../extraction-method.interface';
import { ExtractedContentBase } from '../extraction.service';
import { TemplateService } from '../template.service';
import { TemplateGeneratorService } from '../template-generator.service';
import * as cheerio from 'cheerio';

/**
 * Strategy 0: Template-based extraction (highest priority)
 * Uses AI-generated templates (CSS selectors/XPath) stored in cache/DB
 */
export class TemplateMethod implements ExtractionMethodStrategy {
  private readonly logger = new Logger(TemplateMethod.name);
  readonly name = 'template';
  readonly priority = 0; // Highest priority - try template first

  constructor(
    private templateService: TemplateService,
    private templateGenerator: TemplateGeneratorService,
  ) {}

  /**
   * Can always execute (primary method)
   */
  canExecute(context: ExtractionContext): boolean {
    return true;
  }

  /**
   * Execute template-based extraction
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    try {
      // 1. Get template from cache/DB
      let template = await this.templateService.getTemplate(context.source);

      // 2. If no template exists, try to generate one
      if (!template) {
        this.logger.debug(`No template found for ${context.source}, generating new template...`);
        // Pass reference strategy for hints
        const generatedTemplate = await this.templateGenerator.generateTemplate(
          context.source,
          context.html,
          context.url,
          context.sourceStrategy,
        );

        if (generatedTemplate) {
          await this.templateService.saveTemplate(generatedTemplate);
          template = generatedTemplate;
          this.logger.log(`✅ Generated and saved template for ${context.source} (version ${template.version})`);
        } else {
          // Template generation failed, skip this method
          this.logger.debug(`Template generation failed for ${context.source}, skipping template method`);
          return null;
        }
      } else {
        this.logger.debug(`Using template v${template.version} for ${context.source}`);
      }

      // 3. Extract using template selectors
      this.logger.debug(`Extracting with template selectors: title=${template.titleSelector}, content=${template.contentSelector}`);
      const extracted = this.extractWithTemplate(context.$, template);

      if (extracted && extracted.fullText) {
        // Track success
        await this.templateService.incrementSuccess(context.source);
        context.usedStrategy = `template-v${template.version}`;
        this.logger.log(`✅ Template extraction succeeded for ${context.source} (v${template.version})`);
        return extracted;
      } else {
        // Track failure
        await this.templateService.incrementFail(context.source);
        const titleStatus = extracted?.title ? `"${extracted.title.substring(0, 30)}..."` : 'missing';
        const contentStatus = extracted?.fullText 
          ? `found (${extracted.fullText.length} chars)` 
          : 'missing';
        this.logger.debug(`❌ Template extraction failed for ${context.source}: title=${titleStatus}, content=${contentStatus}`);

        // If template has high fail rate, regenerate
        const totalAttempts = template.successCount + template.failCount;
        const failRate = totalAttempts > 0 ? template.failCount / totalAttempts : 0;
        if (failRate > 0.5 && template.failCount >= 5) {
          this.logger.warn(
            `Template for ${context.source} has high fail rate (${(failRate * 100).toFixed(1)}%, ${template.failCount}/${totalAttempts}), regenerating...`,
          );
          const newTemplate = await this.templateGenerator.generateTemplate(
            context.source,
            context.html,
            context.url,
            context.sourceStrategy,
          );
          if (newTemplate) {
            await this.templateService.regenerateTemplate(context.source, newTemplate);
          }
        }

        return null;
      }
    } catch (error) {
      this.logger.error(`Error executing template method for ${context.source}:`, error);
      return null;
    }
  }

  /**
   * Extract content using template selectors
   * @param $ - Cheerio instance
   * @param template - Extraction template
   * @returns Extracted content or null
   */
  private extractWithTemplate(
    $: cheerio.CheerioAPI,
    template: any,
  ): ExtractedContentBase | null {
    // Extract title
    let title = '';
    if (template.titleSelector) {
      const selectors = template.titleSelector.split(',').map((s: string) => s.trim());
      for (const selector of selectors) {
        try {
          const element = $(selector).first();
          if (element.length) {
            const foundTitle = element.text().trim();
            // Validate title: must be meaningful (not just page title like "Latest News")
            // Skip if title is too short or looks like a page title
            if (foundTitle && foundTitle.length > 10 && !foundTitle.includes('|') && !foundTitle.includes(' - ')) {
              title = foundTitle;
              this.logger.debug(`Template: Found valid title using selector "${selector}": "${title.substring(0, 50)}..."`);
              break;
            } else if (foundTitle) {
              this.logger.debug(`Template: Found title but too short/invalid using selector "${selector}": "${foundTitle}"`);
            }
          }
        } catch (error) {
          this.logger.debug(`Template: Invalid selector "${selector}": ${error}`);
        }
      }
    }

    // Extract summary (optional)
    let summary = '';
    if (template.summarySelector) {
      const selectors = template.summarySelector.split(',').map((s: string) => s.trim());
      for (const selector of selectors) {
        try {
          const element = $(selector).first();
          if (element.length) {
            summary = element.text().trim();
            if (summary) break;
          }
        } catch (error) {
          // Ignore invalid selectors
        }
      }
    }

    // Extract content
    let fullText = '';
    if (template.contentSelector) {
      const selectors = template.contentSelector.split(',').map((s: string) => s.trim());
      for (const selector of selectors) {
        try {
          const element = $(selector).first();
          if (element.length) {
            // Remove unwanted elements
            element.find('script, style, nav, footer, aside, .ad, .advertisement, .social-share').remove();
            
            // Try to extract paragraphs first (more reliable for article content)
            const paragraphs = element.find('p').toArray();
            if (paragraphs.length > 0) {
              fullText = paragraphs
                .map(p => $(p).text().trim())
                .filter(t => t.length > 20) // Filter out short paragraphs (likely navigation)
                .join('\n\n');
            } else {
              // Fallback to direct text extraction
              fullText = element.text().trim();
            }
            
            if (fullText.length > 200) {
              this.logger.debug(`Template: Found content using selector "${selector}" (${fullText.length} chars, ${paragraphs.length} paragraphs)`);
              break; // Valid content found
            } else {
              this.logger.debug(`Template: Content too short using selector "${selector}" (${fullText.length} chars)`);
            }
          } else {
            this.logger.debug(`Template: Selector "${selector}" matched 0 elements`);
          }
        } catch (error) {
          this.logger.debug(`Template: Invalid selector "${selector}": ${error}`);
        }
      }
    }

    // If CSS selectors failed, try XPath (simplified - Cheerio doesn't support XPath natively)
    // For now, we'll skip XPath and rely on CSS selectors

    // Extract publish time
    let publishTime: Date | undefined;
    if (template.publishTimeSelector) {
      const selectors = template.publishTimeSelector.split(',').map((s: string) => s.trim());
      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length) {
          const timeStr = element.attr('datetime') || element.text();
          if (timeStr) {
            const date = new Date(timeStr);
            if (!isNaN(date.getTime())) {
              publishTime = date;
              break;
            }
          }
        }
      }
    }

    if (!title || !fullText) {
      return null;
    }

    return {
      title,
      summary: summary || undefined,
      fullText: this.cleanText(fullText),
      publishTime,
    };
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}

