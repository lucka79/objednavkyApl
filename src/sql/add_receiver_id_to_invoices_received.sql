-- Add receiver_id column to invoices_received table
-- This column will reference the profiles table for the receiver of the invoice

-- Check if the column already exists before adding it
DO $$
BEGIN
    -- Add the receiver_id column only if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices_received' 
        AND column_name = 'receiver_id'
    ) THEN
        ALTER TABLE invoices_received 
        ADD COLUMN receiver_id UUID REFERENCES profiles(id);
        
        -- Add a comment to document the column
        COMMENT ON COLUMN invoices_received.receiver_id IS 'ID of the user who received the invoice (references profiles.id)';
        
        RAISE NOTICE 'Column receiver_id added to invoices_received table';
    ELSE
        RAISE NOTICE 'Column receiver_id already exists in invoices_received table';
    END IF;
END $$;

-- Create an index for better query performance (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'invoices_received' 
        AND indexname = 'idx_invoices_received_receiver_id'
    ) THEN
        CREATE INDEX idx_invoices_received_receiver_id ON invoices_received(receiver_id);
        RAISE NOTICE 'Index idx_invoices_received_receiver_id created';
    ELSE
        RAISE NOTICE 'Index idx_invoices_received_receiver_id already exists';
    END IF;
END $$;

-- Optional: Add a constraint to ensure receiver_id is not null for new records
-- (Uncomment if you want to enforce this constraint)
-- ALTER TABLE invoices_received 
-- ADD CONSTRAINT invoices_received_receiver_id_not_null CHECK (receiver_id IS NOT NULL);
