import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from '../extraction-method.interface';
import { ExtractedContentBase } from '../extraction.service';

/**
 * Strategy 2: XPath extraction (fallback for source-specific strategies)
 * Only used for non-generic sources
 */
export class XPathMethod implements ExtractionMethodStrategy {
  private readonly logger = new Logger(XPathMethod.name);
  readonly name = 'xpath';
  readonly priority = 2;

  /**
   * Can only execute for source-specific strategies (not generic)
   */
  canExecute(context: ExtractionContext): boolean {
    return context.sourceStrategyName !== 'generic';
  }

  /**
   * Execute XPath extraction
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    this.logger.debug(`CSS selector failed for ${context.source}, trying XPath fallback: ${context.url}`);
    
    const result = context.sourceStrategy.extractWithXPath(context.$, context.url);
    
    if (result && result.fullText) {
      context.usedStrategy = `${context.sourceStrategyName}-xpath`;
      return result;
    }

    return null;
  }
}

