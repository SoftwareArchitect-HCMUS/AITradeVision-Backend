import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini AI service for extracting tickers from news content
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set, AI ticker extraction will be disabled');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      this.logger.log('Gemini AI service initialized for ticker extraction');
    } catch (error) {
      this.logger.error('Failed to initialize Gemini AI service', error);
    }
  }

  /**
   * Extract cryptocurrency tickers from news content using AI
   * @param title - News title
   * @param content - News content
   * @returns Array of ticker symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
   */
  async extractTickers(title: string, content: string): Promise<string[]> {
    if (!this.model) {
      this.logger.debug('Gemini AI not available, skipping AI ticker extraction');
      return [];
    }

    const prompt = `
You are a cryptocurrency market analyst. Analyze the following news article and extract all cryptocurrency tickers that are mentioned or relevant to the content.

News Title: ${title}
News Content: ${content.substring(0, 3000)}

Please identify all cryptocurrency tickers (e.g., BTC, ETH, SOL) that are:
1. Explicitly mentioned in the article
2. Implied or relevant based on the context (e.g., if article mentions "tokenization", include BTC and ETH)
3. Related to companies/projects mentioned (e.g., if article mentions "Binance", include BNB)

Return ONLY a JSON array of ticker symbols in USDT pairs format (e.g., ["BTCUSDT", "ETHUSDT"]).
If no tickers are found or the article is not related to cryptocurrency, return an empty array [].

Examples:
- "Bitcoin price surges" → ["BTCUSDT"]
- "Ethereum DeFi protocol launches" → ["ETHUSDT", "UNIUSDT"]
- "Tokenization gains traction" → ["BTCUSDT", "ETHUSDT"]
- "PayPal crypto payment" → ["BTCUSDT", "LTCUSDT", "XRPUSDT"]

Respond ONLY with the JSON array, no other text:
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract JSON array from response
      // Handle cases where response might have markdown code blocks
      let jsonText = text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      // Parse JSON
      const tickers = JSON.parse(jsonText);
      
      if (!Array.isArray(tickers)) {
        this.logger.warn('AI returned non-array response for tickers');
        return [];
      }

      // Validate and normalize tickers
      const validTickers = tickers
        .filter((t: any) => typeof t === 'string' && t.length > 0)
        .map((t: string) => {
          const upperTicker = t.toUpperCase();
          // Normalize to USDT format
          if (upperTicker.endsWith('USDT')) {
            return upperTicker;
          }
          return `${upperTicker.replace(/USDT|USD|EUR|GBP|JPY$/i, '')}USDT`;
        })
        .filter((t: string) => t.length > 4 && t.length < 15); // Valid ticker length

      if (validTickers.length > 0) {
        this.logger.log(`AI extracted ${validTickers.length} ticker(s): ${validTickers.join(', ')}`);
      }

      return validTickers;
    } catch (error) {
      this.logger.error('Error extracting tickers with AI', error);
      // Return empty array on error to allow fallback to other methods
      return [];
    }
  }
}

