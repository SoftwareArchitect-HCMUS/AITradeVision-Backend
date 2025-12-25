import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from '../extraction-method.interface';
import { ExtractedContentBase } from '../extraction.service';

/**
 * Strategy 5: Groq LLM-based extraction (automatic adaptive fallback)
 * Uses AI to extract content when all manual methods fail
 */
export class GroqLlmMethod implements ExtractionMethodStrategy {
  private readonly logger = new Logger(GroqLlmMethod.name);
  readonly name = 'groq-llm';
  readonly priority = 5;

  /**
   * Can only execute if Groq service is enabled
   */
  canExecute(context: ExtractionContext): boolean {
    return context.groqService.isEnabled();
  }

  /**
   * Execute Groq LLM extraction
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    this.logger.debug(`Manual strategies failed, trying Groq LLM extraction: ${context.url}`);
    
    const result = await context.groqService.extractFromHtml(context.url, context.html);
    
    if (result && result.fullText) {
      context.usedStrategy = 'groq-llm';
      this.logger.log(`✅ Groq LLM extracted content for: ${context.url}`);
      return result;
    }

    this.logger.warn(`⚠️ Groq LLM failed to extract content for: ${context.url}`);
    return null;
  }
}

