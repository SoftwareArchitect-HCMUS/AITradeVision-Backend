import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from '../extraction-method.interface';
import { ExtractedContentBase } from '../extraction.service';

/**
 * Strategy 1: CSS Selector extraction (primary method)
 * Uses source-specific CSS selectors
 */
export class CssSelectorMethod implements ExtractionMethodStrategy {
  private readonly logger = new Logger(CssSelectorMethod.name);
  readonly name = 'css-selector';
  readonly priority = 1;

  /**
   * Can always execute (primary method)
   */
  canExecute(context: ExtractionContext): boolean {
    return true;
  }

  /**
   * Execute CSS selector extraction
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    const result = context.sourceStrategy.extractWithSelector(context.$, context.url);
    
    if (result && result.fullText) {
      const strategyName = context.sourceStrategyName === 'generic' 
        ? 'generic-selector' 
        : `${context.sourceStrategyName}-selector`;
      context.usedStrategy = strategyName;
      return result;
    }

    return null;
  }
}

