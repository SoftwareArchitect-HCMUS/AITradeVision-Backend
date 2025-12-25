import { Logger } from '@nestjs/common';
import { ExtractionMethodStrategy, ExtractionContext } from './extraction-method.interface';
import { ExtractedContentBase } from './extraction.service';

/**
 * Chain of Responsibility for extraction methods
 * Executes extraction methods in priority order until one succeeds
 */
export class ExtractionChain {
  private readonly logger = new Logger(ExtractionChain.name);
  private readonly strategies: ExtractionMethodStrategy[] = [];

  /**
   * Add an extraction method strategy to the chain
   * @param strategy - Extraction method strategy
   */
  addStrategy(strategy: ExtractionMethodStrategy): void {
    this.strategies.push(strategy);
    // Sort by priority (lower number = higher priority)
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute the chain of extraction methods
   * Tries each method in priority order until one succeeds
   * @param context - Extraction context
   * @returns Extracted content or null if all methods fail
   */
  async execute(context: ExtractionContext): Promise<ExtractedContentBase | null> {
    for (const strategy of this.strategies) {
      // Check if strategy can execute
      if (!strategy.canExecute(context)) {
        this.logger.debug(`Skipping ${strategy.name} (cannot execute)`);
        continue;
      }

      // Try to execute strategy
      try {
        const result = await strategy.execute(context);
        
        if (result && result.fullText) {
          this.logger.debug(`✅ Extraction succeeded using ${strategy.name}`);
          return result;
        }
      } catch (error) {
        this.logger.warn(`Error executing ${strategy.name}:`, error);
        // Continue to next strategy
      }
    }

    // All strategies failed
    this.logger.warn(`All extraction methods failed for: ${context.url}`);
    return null;
  }

  /**
   * Get all registered strategies
   * @returns Array of strategies sorted by priority
   */
  getStrategies(): ExtractionMethodStrategy[] {
    return [...this.strategies];
  }
}

