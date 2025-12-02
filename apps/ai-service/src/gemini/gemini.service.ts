import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
  reasoning: string;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  embedding: number[];
}

/**
 * Gemini AI service for news analysis
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;
  private embeddingModel: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set, AI features will be disabled');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    // Note: Gemini embedding model may vary, adjust as needed
    try {
      this.embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
    } catch {
      // Fallback if embedding model not available
      this.embeddingModel = null;
    }
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
    if (!this.model) {
      throw new Error('Gemini API key not configured');
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
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

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
      this.logger.error('Error analyzing news with Gemini', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text
   * @param text - Text to embed
   * @returns Embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModel) {
      // Return dummy embedding if model not available
      return new Array(768).fill(0).map(() => Math.random() - 0.5);
    }

    try {
      const result = await this.embeddingModel.embedContent(text);
      // Handle different response formats
      if (result.embedding) {
        return Array.isArray(result.embedding) 
          ? result.embedding 
          : (result.embedding.values || []);
      }
      // Fallback to dummy embedding
      return new Array(768).fill(0).map(() => Math.random() - 0.5);
    } catch (error) {
      this.logger.error('Error generating embedding', error);
      // Return dummy embedding on error
      return new Array(768).fill(0).map(() => Math.random() - 0.5);
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

