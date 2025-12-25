import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { ExtractedContentBase } from '../crawler/extraction/extraction.service';

/**
 * GroqService provides LLM-based HTML extraction using Groq API.
 * It is used as a fallback when manual selectors fail.
 */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private client: Groq | null = null;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is not set. LLM-based extraction will be skipped.');
      return;
    }

    this.client = new Groq({ apiKey });
  }

  /**
   * Check if Groq client is available.
   * @returns boolean
   */
  isEnabled(): boolean {
    return !!this.client;
  }

  /**
   * Extract content from raw HTML using Groq LLM.
   * @param url Article URL
   * @param html Raw HTML content
   * @returns ExtractedContentBase or null
   */
  async extractFromHtml(url: string, html: string): Promise<ExtractedContentBase | null> {
    if (!this.client) {
      return null;
    }

    try {
      const prompt = `
You are an expert content extractor for news articles.
Given the raw HTML, extract:
- title (string, required)
- summary (string, optional, concise <= 2 sentences)
- fullText (string, required, clean article body, no ads/nav)
- publishTime (ISO string or empty if unknown)

Return ONLY JSON in the format:
{"title": "...", "summary": "...", "fullText": "...", "publishTime": "2024-01-01T00:00:00Z"}

If publish time is missing, set publishTime to empty string.
Do not include any other text.
URL: ${url}
HTML:
${html.substring(0, 6000)}
`;

      const response = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: 'system', content: 'Extract structured article content as JSON.' },
          { role: 'user', content: prompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content || '';
      if (!content) {
        this.logger.warn(`Groq returned empty content for ${url}`);
        return null;
      }

      // Extract JSON block
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : content;

      const parsed = JSON.parse(jsonText);
      if (!parsed.title || !parsed.fullText) {
        this.logger.warn(`Groq extraction missing required fields for ${url}`);
        return null;
      }

      const publishTime =
        typeof parsed.publishTime === 'string' && parsed.publishTime.trim().length > 0
          ? new Date(parsed.publishTime)
          : undefined;

      return {
        title: String(parsed.title).trim(),
        summary: parsed.summary ? String(parsed.summary).trim() : undefined,
        fullText: String(parsed.fullText).trim(),
        publishTime,
      };
    } catch (error) {
      this.logger.error(`Groq extraction failed for ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract cryptocurrency tickers from news content using Groq LLM.
   * @param title - News title
   * @param content - News content
   * @returns Array of ticker symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
   */
  async extractTickers(title: string, content: string): Promise<string[]> {
    if (!this.client) {
      this.logger.debug('Groq not available, skipping AI ticker extraction');
      return [];
    }

    try {
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

      const response = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'Extract cryptocurrency tickers as JSON array.' },
          { role: 'user', content: prompt },
        ],
      });

      const text = response.choices?.[0]?.message?.content?.trim() || '';
      if (!text) {
        this.logger.warn('Groq returned empty response for ticker extraction');
        return [];
      }

      // Extract JSON array from response
      let jsonText = text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const tickers = JSON.parse(jsonText);

      if (!Array.isArray(tickers)) {
        this.logger.warn('Groq returned non-array response for tickers');
        return [];
      }

      // Filter and normalize tickers to ensure they are valid USDT pairs
      const validTickers = tickers
        .map((t: string) => t.toUpperCase())
        .filter((t: string) => t.endsWith('USDT') && t.length > 4 && t.length < 15); // Basic validation

      if (validTickers.length > 0) {
        this.logger.log(`Groq extracted ${validTickers.length} ticker(s): ${validTickers.join(', ')}`);
      }

      return validTickers;
    } catch (error) {
      this.logger.error('Error extracting tickers with Groq:', error);
      return [];
    }
  }
}

