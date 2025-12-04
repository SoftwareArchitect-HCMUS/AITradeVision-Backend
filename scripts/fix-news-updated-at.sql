-- Fix: Add updated_at column to news table if it doesn't exist
-- This migration fixes the "column NewsEntity.updated_at does not exist" error

-- Check and add updated_at column to news table
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
        
        -- Create trigger to auto-update updated_at on row update
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        CREATE TRIGGER update_news_updated_at 
        BEFORE UPDATE ON news 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Added updated_at column to news table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in news table';
    END IF;
END $$;

