-- Add geocoding fields to profiles table
-- Run this in your Supabase SQL editor

-- Add latitude and longitude columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

-- Add formatted address and place_id columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS formatted_address TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS place_id TEXT;

-- Add indexes for better performance on geospatial queries
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng ON profiles(lat, lng);
CREATE INDEX IF NOT EXISTS idx_profiles_place_id ON profiles(place_id);

-- Add comments for documentation
COMMENT ON COLUMN profiles.lat IS 'Latitude coordinate from Google Geocoding API';
COMMENT ON COLUMN profiles.lng IS 'Longitude coordinate from Google Geocoding API';
COMMENT ON COLUMN profiles.formatted_address IS 'Formatted address from Google Geocoding API';
COMMENT ON COLUMN profiles.place_id IS 'Google Place ID for the address';
