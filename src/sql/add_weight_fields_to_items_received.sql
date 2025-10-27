-- Add weight-based fields to items_received table for MAKRO and similar suppliers
-- These fields store weight calculations and price per kg for items sold by weight

ALTER TABLE public.items_received
ADD COLUMN IF NOT EXISTS package_weight_kg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS total_weight_kg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS price_per_kg DECIMAL(10,2);

-- Add comments for clarity
COMMENT ON COLUMN public.items_received.package_weight_kg IS 'Weight of a single package/unit in kilograms (e.g., 0.1 kg for 100g)';
COMMENT ON COLUMN public.items_received.total_weight_kg IS 'Total weight in kilograms (package_weight_kg × quantity or units_in_mu)';
COMMENT ON COLUMN public.items_received.price_per_kg IS 'Calculated price per kilogram (line_total ÷ total_weight_kg)';

