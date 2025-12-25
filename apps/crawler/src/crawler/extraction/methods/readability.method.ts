import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from '../extraction-method.interface';
import { ExtractedContentBase } from '../extraction.service';
import { GenericStrategy } from '../../strategies/generic.strategy';

/**
 * Strategy 4: Readability-like algorithm extraction (last manual resort)
 * Uses a generic readability algorithm to extract content
 */
export class ReadabilityMethod implements ExtractionMethodStrategy {
  private readonly logger = new Logger(ReadabilityMethod.name);
  readonly name = 'readability';
  readonly priority = 4;

  /**
   * Can always execute (fallback method)
   */
  canExecute(context: ExtractionContext): boolean {
    return true;
  }

  /**
   * Execute readability algorithm extraction
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    this.logger.debug(`All selector strategies failed, trying readability algorithm: ${context.url}`);
    
    // Use extractGeneric method from GenericStrategy
    // GenericStrategy has extractGeneric method (not in interface, but exists)
    if (context.genericStrategy instanceof GenericStrategy) {
      const result = (context.genericStrategy as GenericStrategy & { extractGeneric: (cheerio: any, url: string) => ExtractedContentBase | null }).extractGeneric(context.$, context.url);
      
      if (result && result.fullText) {
        context.usedStrategy = 'readability-algorithm';
        return result;
      }
    } else {
      // Fallback: try to call extractGeneric if it exists
      const genericStrategy = context.genericStrategy as any;
      if (typeof genericStrategy.extractGeneric === 'function') {
        const result = genericStrategy.extractGeneric(context.$, context.url);
        
        if (result && result.fullText) {
          context.usedStrategy = 'readability-algorithm';
          return result;
        }
      }
    }

    return null;
  }
}

