import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('news')
export class NewsEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'text', name: 'full_text' })
  fullText!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tickers!: string[];

  @Column({ type: 'varchar', length: 100 })
  source!: string;

  @Column({ type: 'timestamp', name: 'publish_time' })
  publishTime!: Date;

  @Column({ type: 'text', unique: true })
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'minio_object_key' })
  minioObjectKey?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

