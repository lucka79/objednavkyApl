# Geocoding Setup Guide

This guide explains how to set up Google Maps Geocoding API for the AdminTable component.

## Prerequisites

1. A Google Cloud Platform account
2. A Google Maps API key with Geocoding API enabled

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project

### 2. Enable Geocoding API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Geocoding API"
3. Click on "Geocoding API" and click "Enable"

### 3. Create API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key

### 4. Restrict API Key (Recommended)

1. Click on the created API key to edit it
2. Under "Application restrictions", select "HTTP referrers (websites)"
3. Add your domain(s) to the allowed referrers
4. Under "API restrictions", select "Restrict key"
5. Select "Geocoding API" from the list
6. Click "Save"

### 5. Add Environment Variable

Add the following to your `.env` file:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 6. Database Migration

Run the following SQL in your Supabase SQL editor:

```sql
-- Add geocoding fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS formatted_address TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS place_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng ON profiles(lat, lng);
CREATE INDEX IF NOT EXISTS idx_profiles_place_id ON profiles(place_id);
```

## Usage

Once set up, you can:

1. **Individual Geocoding**: Click the map pin icon next to any user with an address
2. **Bulk Geocoding**: Click "Geocode All" to geocode all visible users with addresses
3. **View Status**: The "Location" column shows geocoding status and coordinates

## Features

- ✅ Individual address geocoding
- ✅ Bulk geocoding for multiple users
- ✅ Visual feedback with loading states
- ✅ Error handling and user notifications
- ✅ Coordinate display in the table
- ✅ Formatted address storage

## API Limits

- Google Geocoding API has a limit of 2,500 requests per day for free tier
- Consider upgrading to a paid plan for higher usage
- Implement rate limiting for bulk operations if needed

## Troubleshooting

### "API_KEY_MISSING" Error
- Ensure `VITE_GOOGLE_MAPS_API_KEY` is set in your environment variables
- Restart your development server after adding the environment variable

### "REQUEST_DENIED" Error
- Check if the Geocoding API is enabled in your Google Cloud project
- Verify API key restrictions allow your domain
- Ensure billing is enabled for the project

### "ZERO_RESULTS" Error
- The address might be too specific or contain typos
- Try using a more general address format
- Check if the address exists in Google's database
