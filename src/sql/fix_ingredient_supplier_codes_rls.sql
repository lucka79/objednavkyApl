-- Fix RLS policies for ingredient_supplier_codes table
-- The 403 error indicates permission issues

-- First, check if the table exists and has RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ingredient_supplier_codes';

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view ingredient supplier codes" ON ingredient_supplier_codes;
DROP POLICY IF EXISTS "Users can insert ingredient supplier codes" ON ingredient_supplier_codes;
DROP POLICY IF EXISTS "Users can update ingredient supplier codes" ON ingredient_supplier_codes;
DROP POLICY IF EXISTS "Users can delete ingredient supplier codes" ON ingredient_supplier_codes;

-- Create more permissive policies for authenticated users
CREATE POLICY "Authenticated users can view ingredient supplier codes" ON ingredient_supplier_codes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert ingredient supplier codes" ON ingredient_supplier_codes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update ingredient supplier codes" ON ingredient_supplier_codes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete ingredient supplier codes" ON ingredient_supplier_codes
  FOR DELETE USING (auth.role() = 'authenticated');

-- Alternative: If you want to disable RLS temporarily for testing
-- ALTER TABLE ingredient_supplier_codes DISABLE ROW LEVEL SECURITY;

-- Grant explicit permissions
GRANT ALL ON ingredient_supplier_codes TO authenticated;
GRANT ALL ON ingredient_supplier_codes TO anon;

-- Test the access
SELECT COUNT(*) FROM ingredient_supplier_codes;
