-- Migration script - runs after init to ensure schema is up to date

-- Add is_vip column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_vip'
    ) THEN
        ALTER TABLE users ADD COLUMN is_vip BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
