-- Fix: Add missing columns to news table
-- This migration fixes:
-- 1. "column NewsEntity.updated_at does not exist"
-- 2. "column NewsEntity.minio_object_key does not exist"

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'news' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE news 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        RAISE NOTICE 'Added updated_at column to news table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in news table';
    END IF;
END $$;

-- Add minio_object_key column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'news' 
        AND column_name = 'minio_object_key'
    ) THEN
        ALTER TABLE news 
        ADD COLUMN minio_object_key VARCHAR(255);
        
        RAISE NOTICE 'Added minio_object_key column to news table';
    ELSE
        RAISE NOTICE 'minio_object_key column already exists in news table';
    END IF;
END $$;

-- Create or replace trigger to auto-update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_news_updated_at ON news;

CREATE TRIGGER update_news_updated_at 
BEFORE UPDATE ON news 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Verify columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'news' 
AND column_name IN ('updated_at', 'minio_object_key')
ORDER BY column_name;

