import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { NewsEntity } from './news.entity';

@Entity('ai_insights')
export class AIInsightEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', name: 'news_id' })
  newsId!: number;

  @ManyToOne(() => NewsEntity)
  @JoinColumn({ name: 'news_id' })
  news?: NewsEntity;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ type: 'varchar', length: 20 })
  sentiment!: 'positive' | 'negative' | 'neutral';

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'text' })
  reasoning!: string;

  @Column({ type: 'varchar', length: 10 })
  prediction!: 'UP' | 'DOWN' | 'NEUTRAL';

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence!: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'embedding_id' })
  embeddingId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

