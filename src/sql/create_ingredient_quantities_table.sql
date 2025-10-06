-- Create ingredient_quantities table to track current stock levels
CREATE TABLE IF NOT EXISTS ingredient_quantities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  current_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to ensure one quantity record per ingredient
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_quantities_ingredient_id_unique 
ON ingredient_quantities(ingredient_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ingredient_quantities_ingredient_id 
ON ingredient_quantities(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredient_quantities_current_quantity 
ON ingredient_quantities(current_quantity);

-- Create RLS policies
ALTER TABLE ingredient_quantities ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read ingredient quantities
CREATE POLICY "Allow authenticated users to read ingredient quantities" 
ON ingredient_quantities FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to insert ingredient quantities
CREATE POLICY "Allow authenticated users to insert ingredient quantities" 
ON ingredient_quantities FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to update ingredient quantities
CREATE POLICY "Allow authenticated users to update ingredient quantities" 
ON ingredient_quantities FOR UPDATE 
TO authenticated 
USING (true);

-- Allow authenticated users to delete ingredient quantities
CREATE POLICY "Allow authenticated users to delete ingredient quantities" 
ON ingredient_quantities FOR DELETE 
TO authenticated 
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ingredient_quantities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_ingredient_quantities_updated_at
  BEFORE UPDATE ON ingredient_quantities
  FOR EACH ROW
  EXECUTE FUNCTION update_ingredient_quantities_updated_at();

-- Create function to initialize ingredient quantities from user's inventory_items
CREATE OR REPLACE FUNCTION initialize_ingredient_quantities(p_user_id UUID DEFAULT 'e597fcc9-7ce8-407d-ad1a-fdace061e42f')
RETURNS VOID AS $$
BEGIN
  -- Insert or update quantity records based on user's inventory_items
  INSERT INTO ingredient_quantities (ingredient_id, current_quantity, unit)
  SELECT 
    ii.ingredient_id,
    COALESCE(SUM(ii.quantity), 0) as total_quantity,
    i.unit
  FROM inventory_items ii
  JOIN ingredients i ON ii.ingredient_id = i.id
  WHERE ii.user_id = p_user_id
  AND i.active = true
  GROUP BY ii.ingredient_id, i.unit
  ON CONFLICT (ingredient_id) 
  DO UPDATE SET 
    current_quantity = EXCLUDED.current_quantity,
    last_updated = NOW();
    
  -- Also initialize ingredients that don't have inventory_items but are active
  INSERT INTO ingredient_quantities (ingredient_id, current_quantity, unit)
  SELECT 
    i.id, 
    0, -- Start with 0 quantity for ingredients not in inventory
    i.unit
  FROM ingredients i
  LEFT JOIN ingredient_quantities iq ON i.id = iq.ingredient_id
  LEFT JOIN inventory_items ii ON i.id = ii.ingredient_id AND ii.user_id = p_user_id
  WHERE iq.id IS NULL
  AND i.active = true
  AND ii.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Run the initialization function
SELECT initialize_ingredient_quantities();

-- Create function to update ingredient quantity (for transfers and invoices)
CREATE OR REPLACE FUNCTION update_ingredient_quantity(
  p_ingredient_id INTEGER,
  p_quantity_change DECIMAL(10,3),
  p_operation_type VARCHAR(20) -- 'increase' or 'decrease'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_qty DECIMAL(10,3);
  new_qty DECIMAL(10,3);
BEGIN
  -- Get current quantity
  SELECT current_quantity INTO current_qty
  FROM ingredient_quantities
  WHERE ingredient_id = p_ingredient_id;
  
  -- If no record exists, create one
  IF current_qty IS NULL THEN
    INSERT INTO ingredient_quantities (ingredient_id, current_quantity, unit)
    SELECT id, 0, unit FROM ingredients WHERE id = p_ingredient_id;
    current_qty := 0;
  END IF;
  
  -- Calculate new quantity
  IF p_operation_type = 'increase' THEN
    new_qty := current_qty + p_quantity_change;
  ELSIF p_operation_type = 'decrease' THEN
    new_qty := current_qty - p_quantity_change;
    -- Prevent negative quantities
    IF new_qty < 0 THEN
      new_qty := 0;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
  
  -- Update the quantity
  UPDATE ingredient_quantities
  SET 
    current_quantity = new_qty,
    last_updated = NOW()
  WHERE ingredient_id = p_ingredient_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get ingredient quantity
CREATE OR REPLACE FUNCTION get_ingredient_quantity(p_ingredient_id INTEGER)
RETURNS DECIMAL(10,3) AS $$
DECLARE
  qty DECIMAL(10,3);
BEGIN
  SELECT current_quantity INTO qty
  FROM ingredient_quantities
  WHERE ingredient_id = p_ingredient_id;
  
  RETURN COALESCE(qty, 0);
END;
$$ LANGUAGE plpgsql;
