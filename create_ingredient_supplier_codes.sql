-- Create table for multiple supplier codes per ingredient
CREATE TABLE IF NOT EXISTS ingredient_supplier_codes (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ingredient_id, supplier_id, product_code)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_supplier_codes_ingredient_id ON ingredient_supplier_codes(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_supplier_codes_supplier_id ON ingredient_supplier_codes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_supplier_codes_active ON ingredient_supplier_codes(ingredient_id, is_active) WHERE is_active = TRUE;

-- Function to ensure only one active supplier per ingredient
CREATE OR REPLACE FUNCTION ensure_single_active_supplier()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_active to TRUE, set all others for this ingredient to FALSE
  IF NEW.is_active = TRUE THEN
    UPDATE ingredient_supplier_codes 
    SET is_active = FALSE 
    WHERE ingredient_id = NEW.ingredient_id 
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure only one active supplier per ingredient
DROP TRIGGER IF EXISTS trigger_single_active_supplier ON ingredient_supplier_codes;
CREATE TRIGGER trigger_single_active_supplier
  BEFORE INSERT OR UPDATE ON ingredient_supplier_codes
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_supplier();

-- Add RLS policies
ALTER TABLE ingredient_supplier_codes ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Users can view ingredient supplier codes" ON ingredient_supplier_codes
  FOR SELECT USING (auth.role() IN ('admin', 'expedition', 'store'));

CREATE POLICY "Users can insert ingredient supplier codes" ON ingredient_supplier_codes
  FOR INSERT WITH CHECK (auth.role() IN ('admin', 'expedition'));

CREATE POLICY "Users can update ingredient supplier codes" ON ingredient_supplier_codes
  FOR UPDATE USING (auth.role() IN ('admin', 'expedition'));

CREATE POLICY "Users can delete ingredient supplier codes" ON ingredient_supplier_codes
  FOR DELETE USING (auth.role() IN ('admin', 'expedition'));

-- Insert some example data (optional)
-- INSERT INTO ingredient_supplier_codes (ingredient_id, supplier_id, product_code, price, is_active) VALUES
-- (1, 'supplier-a-id', '0101', 15.50, TRUE),
-- (1, 'supplier-b-id', '1001', 18.75, FALSE);
