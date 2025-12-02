import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as MinIO from 'minio';

/**
 * MinIO service for storing raw HTML files
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: MinIO.Client;
  private readonly bucketName = process.env.MINIO_BUCKET || 'raw-html';

  constructor() {
    this.client = new MinIO.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  /**
   * Initialize MinIO client and create bucket if it doesn't exist
   */
  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created`);
      }
      this.logger.log('MinIO client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize MinIO', error);
      throw error;
    }
  }

  /**
   * Upload HTML content to MinIO
   * @param objectName - Object name/key
   * @param htmlContent - HTML content as string
   * @returns Object key
   */
  async uploadHTML(objectName: string, htmlContent: string): Promise<string> {
    try {
      const buffer = Buffer.from(htmlContent, 'utf-8');
      await this.client.putObject(this.bucketName, objectName, buffer, buffer.length, {
        'Content-Type': 'text/html',
      });
      this.logger.debug(`Uploaded HTML to ${objectName}`);
      return objectName;
    } catch (error) {
      this.logger.error(`Failed to upload HTML: ${objectName}`, error);
      throw error;
    }
  }

  /**
   * Generate a unique object key for HTML storage
   * @param source - News source
   * @param url - Article URL
   * @returns Object key
   */
  generateObjectKey(source: string, url: string): string {
    const timestamp = Date.now();
    const urlHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    return `${source}/${timestamp}-${urlHash}.html`;
  }
}

