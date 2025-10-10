-- Create table for daily ingredient consumption tracking
-- This tracks both recipe-based and direct ingredient consumption from orders

CREATE TABLE IF NOT EXISTS public.daily_ingredient_consumption (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ingredient_id BIGINT NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 0,
    source TEXT NOT NULL CHECK (source IN ('recipe', 'direct')),
    order_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(date, ingredient_id, product_id, source)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_ingredient_consumption_date ON public.daily_ingredient_consumption(date);
CREATE INDEX IF NOT EXISTS idx_daily_ingredient_consumption_ingredient_id ON public.daily_ingredient_consumption(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_daily_ingredient_consumption_product_id ON public.daily_ingredient_consumption(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_ingredient_consumption_date_ingredient ON public.daily_ingredient_consumption(date, ingredient_id);

-- Enable Row Level Security
ALTER TABLE public.daily_ingredient_consumption ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON public.daily_ingredient_consumption
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.daily_ingredient_consumption
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.daily_ingredient_consumption
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.daily_ingredient_consumption
    FOR DELETE
    TO authenticated
    USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_ingredient_consumption_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_daily_ingredient_consumption_updated_at ON public.daily_ingredient_consumption;
CREATE TRIGGER update_daily_ingredient_consumption_updated_at
    BEFORE UPDATE ON public.daily_ingredient_consumption
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_ingredient_consumption_updated_at();

-- Add comment to table
COMMENT ON TABLE public.daily_ingredient_consumption IS 'Tracks daily consumption of ingredients from orders, including both recipe-based and direct ingredient usage';
COMMENT ON COLUMN public.daily_ingredient_consumption.source IS 'Source of consumption: recipe (from product recipe) or direct (directly linked to product)';
COMMENT ON COLUMN public.daily_ingredient_consumption.order_count IS 'Number of orders that contributed to this consumption';

