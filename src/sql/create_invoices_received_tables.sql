-- Create invoices_received table
CREATE TABLE IF NOT EXISTS public.invoices_received (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(255) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    received_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create items_received table
CREATE TABLE IF NOT EXISTS public.items_received (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES public.invoices_received(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_received_supplier_id ON public.invoices_received(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_received_received_date ON public.invoices_received(received_date);
CREATE INDEX IF NOT EXISTS idx_invoices_received_status ON public.invoices_received(status);
CREATE INDEX IF NOT EXISTS idx_items_received_invoice_id ON public.items_received(invoice_id);
CREATE INDEX IF NOT EXISTS idx_items_received_ingredient_id ON public.items_received(ingredient_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.invoices_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_received ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoices_received
CREATE POLICY "Users can view all invoices_received" ON public.invoices_received
    FOR SELECT USING (true);

CREATE POLICY "Users can insert invoices_received" ON public.invoices_received
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update invoices_received" ON public.invoices_received
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete invoices_received" ON public.invoices_received
    FOR DELETE USING (true);

-- Create RLS policies for items_received
CREATE POLICY "Users can view all items_received" ON public.items_received
    FOR SELECT USING (true);

CREATE POLICY "Users can insert items_received" ON public.items_received
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update items_received" ON public.items_received
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete items_received" ON public.items_received
    FOR DELETE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_invoices_received_updated_at 
    BEFORE UPDATE ON public.invoices_received 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_received_updated_at 
    BEFORE UPDATE ON public.items_received 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
