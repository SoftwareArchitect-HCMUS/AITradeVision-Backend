import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

export interface AIAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
  reasoning: string;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
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

      return {
        sentiment: analysis.sentiment || 'neutral',
        summary: analysis.summary || '',
        reasoning: analysis.reasoning || '',
        prediction: analysis.prediction || 'NEUTRAL',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 50)),
      };
    } catch (error) {
      this.logger.error('Error analyzing news with Groq', error);
      throw error;
    }
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

