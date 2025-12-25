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
            size: 768,
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
      // Validate embedding
      if (!Array.isArray(embedding)) {
        throw new Error(`Embedding must be an array, got ${typeof embedding}`);
      }

      if (embedding.length !== 768) {
        this.logger.warn(`Embedding size mismatch: expected 768, got ${embedding.length}. Truncating or padding...`);
        // Pad or truncate to 768
        if (embedding.length < 768) {
          embedding = [...embedding, ...new Array(768 - embedding.length).fill(0)];
        } else {
          embedding = embedding.slice(0, 768);
        }
      }

      // Validate all values are numbers
      const validEmbedding = embedding.map((val, idx) => {
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        if (isNaN(num) || !isFinite(num)) {
          this.logger.warn(`Invalid embedding value at index ${idx}: ${val}, replacing with 0`);
          return 0;
        }
        return num;
      });

      this.logger.debug(`Storing embedding: ${id}, size: ${validEmbedding.length}, sample: [${validEmbedding.slice(0, 3).join(', ')}...]`);

      // Qdrant requires numeric ID or UUID string
      // Convert string ID to numeric hash if needed
      let pointId: string | number = id;
      if (typeof id === 'string' && !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // Convert string to numeric hash for Qdrant
        pointId = this.stringToNumericId(id);
      }

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: validEmbedding,
            payload,
          },
        ],
      });

      this.logger.debug(`Stored embedding: ${id}`);
      return id;
    } catch (error: any) {
      this.logger.error('Failed to store embedding', error);
      this.logger.error(`Embedding details: size=${embedding?.length}, type=${typeof embedding}, isArray=${Array.isArray(embedding)}`);
      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        this.logger.error(`First 5 values: ${embedding.slice(0, 5).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Convert string ID to numeric ID for Qdrant
   * @param str - String ID
   * @returns Numeric ID
   */
  private stringToNumericId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
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

