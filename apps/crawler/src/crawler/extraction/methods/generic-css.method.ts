import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from '../extraction-method.interface';
import { ExtractedContentBase } from '../extraction.service';

/**
 * Strategy 3: Generic CSS Selector extraction (fallback)
 * Uses generic CSS selectors when source-specific strategies fail
 */
export class GenericCssMethod implements ExtractionMethodStrategy {
  private readonly logger = new Logger(GenericCssMethod.name);
  readonly name = 'generic-css';
  readonly priority = 3;

  /**
   * Can always execute (fallback method)
   */
  canExecute(context: ExtractionContext): boolean {
    return true;
  }

  /**
   * Execute generic CSS selector extraction
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    // Only try if source-specific strategy failed
    if (context.sourceStrategyName === 'generic') {
      return null; // Already tried in Strategy 1
    }

    this.logger.debug(`Source-specific strategy failed for ${context.source}, trying generic selectors: ${context.url}`);
    
    const result = context.genericStrategy.extractWithSelector(context.$, context.url);
    
    if (result && result.fullText) {
      context.usedStrategy = 'generic-selector-fallback';
      return result;
    }

    return null;
  }
}

