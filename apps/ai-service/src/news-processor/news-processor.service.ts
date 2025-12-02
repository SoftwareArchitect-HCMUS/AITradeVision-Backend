import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { GeminiService } from '../gemini/gemini.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { NewsCreatedEvent } from '@shared/events/news.events';

/**
 * Service for processing news events and generating AI insights
 */
@Injectable()
export class NewsProcessorService implements OnModuleInit {
  private readonly logger = new Logger(NewsProcessorService.name);

  constructor(
    private redisService: RedisService,
    private databaseService: DatabaseService,
    private geminiService: GeminiService,
    private qdrantService: QdrantService,
  ) {}

  /**
   * Initialize news event listener
   */
  async onModuleInit(): Promise<void> {
    this.redisService.onNewsCreated(async (event: NewsCreatedEvent) => {
      await this.processNewsEvent(event);
    });

    this.logger.log('News processor service initialized');
  }

  /**
   * Process news created event
   * @param event - News created event
   */
  private async processNewsEvent(event: NewsCreatedEvent): Promise<void> {
    this.logger.log(`Processing news event: ${event.newsId}`);

    try {
      // Get full news article
      const news = await this.databaseService.getNewsById(event.newsId);
      if (!news) {
        this.logger.warn(`News not found: ${event.newsId}`);
        return;
      }

      // Process each ticker mentioned in the news
      for (const ticker of event.tickers) {
        // Get historical price data (last 24 hours)
        const priceData = await this.databaseService.getHistoricalPrice(ticker, 24);

        // Analyze with Gemini
        const analysis = await this.geminiService.analyzeNews(
          news.title,
          news.fullText,
          priceData,
          ticker,
        );

        // Store embedding in Qdrant
        const embeddingId = `news_${event.newsId}_${ticker}_${Date.now()}`;
        await this.qdrantService.storeEmbedding(embeddingId, analysis.embedding, {
          newsId: event.newsId,
          symbol: ticker,
          title: news.title,
          summary: analysis.summary,
          sentiment: analysis.sentiment,
        });

        // Save AI insight to database
        await this.databaseService.saveInsight({
          newsId: event.newsId,
          symbol: ticker,
          sentiment: analysis.sentiment,
          summary: analysis.summary,
          reasoning: analysis.reasoning,
          prediction: analysis.prediction,
          confidence: analysis.confidence,
          embeddingId,
        });

        this.logger.log(`Generated AI insight for ${ticker} from news ${event.newsId}`);
      }
    } catch (error) {
      this.logger.error(`Error processing news event ${event.newsId}:`, error);
    }
  }
}

