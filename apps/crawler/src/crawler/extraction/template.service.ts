import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractionTemplateEntity } from '../../database/entities/extraction-template.entity';
import { RedisService } from '../../redis/redis.service';

export interface ExtractionTemplate {
  source: string;
  version: number;
  titleSelector?: string;
  summarySelector?: string;
  contentSelector?: string;
  publishTimeSelector?: string;
  xpathTitle?: string;
  xpathContent?: string;
  isActive: boolean;
  successCount: number;
  failCount: number;
  lastUsedAt?: Date;
}

/**
 * Service for managing extraction templates (Hybrid: Redis cache + PostgreSQL)
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly CACHE_TTL = 604800; // 7 days in seconds
  private readonly CACHE_KEY_PREFIX = 'extraction_template:';

  constructor(
    @InjectRepository(ExtractionTemplateEntity)
    private templateRepository: Repository<ExtractionTemplateEntity>,
    private redisService: RedisService,
  ) {}

  /**
   * Get active template for a source (checks Redis cache first, then PostgreSQL)
   * @param source - News source name
   * @returns Template or null if not found
   */
  async getTemplate(source: string): Promise<ExtractionTemplate | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${source}`;

    try {
      // 1. Check Redis cache first (fast)
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Template cache hit for ${source}`);
        return JSON.parse(cached);
      }

      // 2. Query PostgreSQL (persistent)
      this.logger.debug(`Template cache miss for ${source}, querying database`);
      const template = await this.templateRepository.findOne({
        where: { source, isActive: true },
        order: { version: 'DESC' },
      });

      if (!template) {
        this.logger.debug(`No active template found in database for ${source}`);
        return null;
      }

      this.logger.debug(`Found template v${template.version} for ${source} in database`);

      // 3. Cache in Redis (TTL 7 days)
      const templateData: ExtractionTemplate = {
        source: template.source,
        version: template.version,
        titleSelector: template.titleSelector,
        summarySelector: template.summarySelector,
        contentSelector: template.contentSelector,
        publishTimeSelector: template.publishTimeSelector,
        xpathTitle: template.xpathTitle,
        xpathContent: template.xpathContent,
        isActive: template.isActive,
        successCount: template.successCount,
        failCount: template.failCount,
        lastUsedAt: template.lastUsedAt,
      };

      await this.redisService.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(templateData),
      );

      return templateData;
    } catch (error) {
      this.logger.error(`Error getting template for ${source}:`, error);
      return null;
    }
  }

  /**
   * Save template to PostgreSQL and update Redis cache
   * @param template - Template data
   */
  async saveTemplate(template: ExtractionTemplate): Promise<void> {
    try {
      // 1. Save to PostgreSQL
      const entity = this.templateRepository.create({
        source: template.source,
        version: template.version,
        titleSelector: template.titleSelector,
        summarySelector: template.summarySelector,
        contentSelector: template.contentSelector,
        publishTimeSelector: template.publishTimeSelector,
        xpathTitle: template.xpathTitle,
        xpathContent: template.xpathContent,
        isActive: template.isActive,
        successCount: template.successCount,
        failCount: template.failCount,
        lastUsedAt: template.lastUsedAt,
      });

      await this.templateRepository.save(entity);

      // 2. Update Redis cache
      const cacheKey = `${this.CACHE_KEY_PREFIX}${template.source}`;
      await this.redisService.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(template),
      );

      this.logger.log(`Saved template for ${template.source} (version ${template.version})`);
    } catch (error) {
      this.logger.error(`Error saving template for ${template.source}:`, error);
      throw error;
    }
  }

  /**
   * Increment success count for a template
   * @param source - News source name
   */
  async incrementSuccess(source: string): Promise<void> {
    try {
      const template = await this.templateRepository.findOne({
        where: { source, isActive: true },
        order: { version: 'DESC' },
      });

      if (template) {
        template.successCount += 1;
        template.lastUsedAt = new Date();
        await this.templateRepository.save(template);

        // Invalidate cache
        const cacheKey = `${this.CACHE_KEY_PREFIX}${source}`;
        await this.redisService.del(cacheKey);
      }
    } catch (error) {
      this.logger.error(`Error incrementing success for ${source}:`, error);
    }
  }

  /**
   * Increment fail count for a template
   * @param source - News source name
   */
  async incrementFail(source: string): Promise<void> {
    try {
      const template = await this.templateRepository.findOne({
        where: { source, isActive: true },
        order: { version: 'DESC' },
      });

      if (template) {
        template.failCount += 1;
        await this.templateRepository.save(template);

        // Invalidate cache
        const cacheKey = `${this.CACHE_KEY_PREFIX}${source}`;
        await this.redisService.del(cacheKey);
      }
    } catch (error) {
      this.logger.error(`Error incrementing fail for ${source}:`, error);
    }
  }

  /**
   * Deactivate old template and create new version
   * @param source - News source name
   * @param newTemplate - New template data
   */
  async regenerateTemplate(source: string, newTemplate: ExtractionTemplate): Promise<void> {
    try {
      // Deactivate old templates
      await this.templateRepository.update(
        { source, isActive: true },
        { isActive: false },
      );

      // Create new template with incremented version
      const latestTemplate = await this.templateRepository.findOne({
        where: { source },
        order: { version: 'DESC' },
      });

      newTemplate.version = latestTemplate ? latestTemplate.version + 1 : 1;
      newTemplate.isActive = true;
      newTemplate.successCount = 0;
      newTemplate.failCount = 0;

      await this.saveTemplate(newTemplate);
      this.logger.log(`Regenerated template for ${source} (version ${newTemplate.version})`);
    } catch (error) {
      this.logger.error(`Error regenerating template for ${source}:`, error);
      throw error;
    }
  }
}

