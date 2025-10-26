-- Add notes column to invoices_received table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices_received' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.invoices_received 
        ADD COLUMN notes TEXT;
        
        RAISE NOTICE 'Added notes column to invoices_received table';
    ELSE
        RAISE NOTICE 'notes column already exists in invoices_received table';
    END IF;
END $$;

