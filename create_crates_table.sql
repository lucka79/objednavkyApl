-- Create crates table for tracking daily crate movements
CREATE TABLE IF NOT EXISTS crates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  crate_small_issued INTEGER DEFAULT 0,
  crate_big_issued INTEGER DEFAULT 0,
  crate_small_received INTEGER DEFAULT 0,
  crate_big_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, driver_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_crates_date ON crates(date);
CREATE INDEX IF NOT EXISTS idx_crates_driver_id ON crates(driver_id);
CREATE INDEX IF NOT EXISTS idx_crates_date_driver ON crates(date, driver_id);

-- Add RLS policies
ALTER TABLE crates ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read crates
CREATE POLICY "Users can read crates" ON crates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for admin and expedition users to insert/update/delete crates
CREATE POLICY "Admin and expedition can manage crates" ON crates
  FOR ALL USING (auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'expedition')
    ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_crates_updated_at
  BEFORE UPDATE ON crates
  FOR EACH ROW
  EXECUTE FUNCTION update_crates_updated_at();
