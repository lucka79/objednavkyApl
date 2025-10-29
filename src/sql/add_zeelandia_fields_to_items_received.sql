-- Add Zeelandia-specific fields to items_received table
-- These fields store the "Fakt. mn." (total weight) and "Cena/jed" (unit price) from Zeelandia invoices

ALTER TABLE public.items_received
ADD COLUMN IF NOT EXISTS fakt_mn DECIMAL(10,3), -- Fakt. mn. (total weight in kg)
ADD COLUMN IF NOT EXISTS cena_jed DECIMAL(10,2); -- Cena/jed (unit price per kg)

-- Add comments for clarity
COMMENT ON COLUMN public.items_received.fakt_mn IS 'Fakt. mn. - Total weight in kilograms from Zeelandia invoices';
COMMENT ON COLUMN public.items_received.cena_jed IS 'Cena/jed - Unit price per kilogram from Zeelandia invoices';
