import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

export interface AIAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
  reasoning: string;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  embedding: number[];
}

/**
 * Groq AI service for news analysis
 */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private client: Groq | null = null;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY not set, AI features will be disabled');
      return;
    }

    this.client = new Groq({ apiKey });
  }

  /**
   * Check if Groq client is available
   * @returns boolean
   */
  isEnabled(): boolean {
    return !!this.client;
  }

  /**
   * Analyze news article with price context
   * @param newsTitle - News title
   * @param newsContent - News content
   * @param priceData - Historical price data
   * @param symbol - Trading symbol
   * @returns AI analysis result
   */
  async analyzeNews(
    newsTitle: string,
    newsContent: string,
    priceData: Array<{ timestamp: number; price: number }>,
    symbol: string,
  ): Promise<AIAnalysisResult> {
    if (!this.client) {
      throw new Error('Groq API key not configured');
    }

    // Prepare price context
    const priceContext = priceData.length > 0
      ? `Recent price trend: ${this.formatPriceTrend(priceData)}`
      : 'No recent price data available';

    const prompt = `
You are a financial analyst specializing in cryptocurrency markets. Analyze the following news article and provide insights.

News Title: ${newsTitle}
News Content: ${newsContent.substring(0, 2000)}
Symbol: ${symbol}
${priceContext}

Please provide:
1. Sentiment: positive, negative, or neutral
2. Summary: A brief 2-3 sentence summary of the news
3. Reasoning: Explain why this news might affect the price
4. Prediction: Will the price go UP, DOWN, or remain NEUTRAL in the next 1 hour?
5. Confidence: A number between 0-100 indicating your confidence in the prediction

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral",
  "summary": "...",
  "reasoning": "...",
  "prediction": "UP|DOWN|NEUTRAL",
  "confidence": 0-100
}
`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: 'system', content: 'You are a financial analyst. Provide analysis in JSON format only.' },
          { role: 'user', content: prompt },
        ],
      });

      const text = response.choices?.[0]?.message?.content?.trim() || '';
      if (!text) {
        throw new Error('Groq returned empty response');
      }

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Generate embedding
      const embedding = await this.generateEmbedding(newsTitle + ' ' + newsContent);

      return {
        sentiment: analysis.sentiment || 'neutral',
        summary: analysis.summary || '',
        reasoning: analysis.reasoning || '',
        prediction: analysis.prediction || 'NEUTRAL',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 50)),
        embedding,
      };
    } catch (error) {
      this.logger.error('Error analyzing news with Groq', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text
   * Note: Groq doesn't have a dedicated embedding model, so we use a workaround
   * by generating a text representation and converting it to a vector
   * @param text - Text to embed
   * @returns Embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      // Return dummy embedding if client not available
      return new Array(768).fill(0).map(() => Math.random() - 0.5);
    }

    try {
      // Groq doesn't have embedding API, so we generate a semantic hash
      // This is a workaround - in production, consider using a dedicated embedding service
      const prompt = `Convert the following text into a semantic representation as a JSON array of 768 numbers between -1 and 1 that captures the meaning:
      
Text: ${text.substring(0, 1000)}

Return ONLY a JSON array of 768 numbers, no other text:`;

      const response = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: 'Return only a JSON array of 768 numbers.' },
          { role: 'user', content: prompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content?.trim() || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          const embedding = JSON.parse(jsonMatch[0]);
          if (Array.isArray(embedding)) {
            // Validate and normalize embedding values
            const validEmbedding = embedding
              .map((val: any) => {
                const num = typeof val === 'number' ? val : parseFloat(String(val));
                if (isNaN(num) || !isFinite(num)) {
                  return 0;
                }
                // Clamp to reasonable range
                return Math.max(-1, Math.min(1, num));
              })
              .slice(0, 768); // Ensure max 768 elements

            // Pad to 768 if needed
            while (validEmbedding.length < 768) {
              validEmbedding.push(0);
            }

            if (validEmbedding.length === 768) {
              this.logger.debug(`Generated embedding from Groq: size=${validEmbedding.length}`);
              return validEmbedding;
            }
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse Groq embedding response, using fallback', parseError);
        }
      }

      // Fallback: Generate deterministic embedding from text hash
      this.logger.debug('Using deterministic embedding fallback');
      return this.generateDeterministicEmbedding(text);
    } catch (error) {
      this.logger.error('Error generating embedding with Groq, using fallback', error);
      // Return deterministic embedding on error
      return this.generateDeterministicEmbedding(text);
    }
  }

  /**
   * Generate deterministic embedding from text hash (fallback)
   * @param text - Text to embed
   * @returns Embedding vector
   */
  private generateDeterministicEmbedding(text: string): number[] {
    // Simple hash-based embedding (deterministic)
    const hash = this.simpleHash(text);
    const embedding = new Array(768).fill(0);
    
    for (let i = 0; i < 768; i++) {
      const seed = hash + i * 1000;
      embedding[i] = (Math.sin(seed) + Math.cos(seed * 2)) / 2;
    }
    
    return embedding;
  }

  /**
   * Simple hash function
   * @param str - String to hash
   * @returns Hash value
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Format price trend for context
   * @param priceData - Historical price data
   * @returns Formatted price trend string
   */
  private formatPriceTrend(priceData: Array<{ timestamp: number; price: number }>): string {
    if (priceData.length === 0) return '';

    const firstPrice = priceData[0].price;
    const lastPrice = priceData[priceData.length - 1].price;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

    return `Price moved ${trend} by ${Math.abs(change).toFixed(2)}% over the last ${priceData.length} minutes. Current price: ${lastPrice}`;
  }
}

