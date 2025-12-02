import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Qdrant vector database service
 */
@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private readonly collectionName = 'news_embeddings';

  constructor() {
    this.client = new QdrantClient({
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT || '6333', 10),
    });
  }

  /**
   * Initialize Qdrant collection
   */
  async onModuleInit(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        // Create collection
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Gemini embedding size
            distance: 'Cosine',
          },
        });
        this.logger.log(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        this.logger.log(`Qdrant collection exists: ${this.collectionName}`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant', error);
      throw error;
    }
  }

  /**
   * Store embedding in Qdrant
   * @param id - Unique identifier
   * @param embedding - Embedding vector
   * @param payload - Additional metadata
   * @returns Point ID
   */
  async storeEmbedding(
    id: string,
    embedding: number[],
    payload: Record<string, any>,
  ): Promise<string> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: embedding,
            payload,
          },
        ],
      });

      this.logger.debug(`Stored embedding: ${id}`);
      return id;
    } catch (error) {
      this.logger.error('Failed to store embedding', error);
      throw error;
    }
  }

  /**
   * Search similar embeddings
   * @param queryEmbedding - Query embedding vector
   * @param limit - Maximum number of results
   * @returns Array of search results
   */
  async searchSimilar(
    queryEmbedding: number[],
    limit: number = 10,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, any> }>> {
    try {
      const results = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
      });

      return results.map(result => ({
        id: result.id as string,
        score: result.score,
        payload: result.payload || {},
      }));
    } catch (error) {
      this.logger.error('Failed to search embeddings', error);
      throw error;
    }
  }
}

