import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { GroqService } from '../groq/groq.service';
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
    private groqService: GroqService,
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
    this.logger.log(`Processing news event: ${event.newsId}, tickers from event: ${JSON.stringify(event.tickers)}`);

    try {
      // Get full news article
      const news = await this.databaseService.getNewsById(event.newsId);
      if (!news) {
        this.logger.warn(`News not found: ${event.newsId}`);
        return;
      }

      this.logger.log(`News found: ${news.title}, tickers from DB: ${JSON.stringify(news.tickers)}`);

      // Use tickers from news entity (source of truth) if event.tickers is empty
      const tickers = news.tickers && news.tickers.length > 0 ? news.tickers : event.tickers;

      if (!tickers || tickers.length === 0) {
        this.logger.warn(`No tickers found for news ${event.newsId}, skipping AI analysis`);
        return;
      }

      this.logger.log(`Processing ${tickers.length} ticker(s) for news ${event.newsId}: ${tickers.join(', ')}`);

      // Process each ticker mentioned in the news
      for (const ticker of tickers) {
        try {
          this.logger.log(`Processing ticker ${ticker} for news ${event.newsId}...`);

          // Get historical price data (last 24 hours)
          const priceData = await this.databaseService.getHistoricalPrice(ticker, 24);
          this.logger.log(`Retrieved ${priceData.length} price data points for ${ticker}`);

          // Analyze with Groq
          this.logger.log(`Calling Groq API for ${ticker}...`);
          const analysis = await this.groqService.analyzeNews(
            news.title,
            news.fullText,
            priceData,
            ticker,
          );
          this.logger.log(`Groq analysis completed for ${ticker}: sentiment=${analysis.sentiment}, prediction=${analysis.prediction}, confidence=${analysis.confidence}`);

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
          this.logger.log(`Saving AI insight to database for ${ticker}...`);
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
          this.logger.log(`✅ Generated AI insight for ${ticker} from news ${event.newsId}`);
        } catch (tickerError) {
          this.logger.error(`Error processing ticker ${ticker} for news ${event.newsId}:`, tickerError);
          // Continue with next ticker instead of failing entire news
        }
      }
    } catch (error) {
      this.logger.error(`Error processing news event ${event.newsId}:`, error);
      this.logger.error(`Error stack: ${error.stack}`);
    }
  }
}

