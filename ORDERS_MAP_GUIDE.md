# Orders Map Feature

## Overview

The Orders Map component displays all orders with geolocated addresses on an interactive Google Map. It uses the `user_id` from orders to match with `profiles.user_id` and retrieves the geolocation data (latitude and longitude) stored in the profiles table.

## Features

### 1. **Interactive Map**
- Displays orders as markers on Google Maps
- Click on any marker to see order details
- Markers are grouped by location
- Numbers on markers indicate multiple orders at the same location

### 2. **Filtering**
- **Date Filter**: Select a specific date for orders
  - Defaults to tomorrow
  - Uses calendar date picker for easy selection

- **Driver Filter**: Filter orders by assigned driver
  - All drivers (default)
  - Without driver
  - Specific driver from the list

- **Status Filter**: Filter orders by their status
  - All Statuses (default)
  - Pre-order
  - New
  - Tisk
  - Expedice R
  - Expedice O
  - Přeprava
  - Paid

### 3. **Statistics Dashboard**
Three cards display key metrics:
- **Total Orders**: Number of orders matching the current filters
- **Total Value**: Sum of all order totals in CZK
- **Unique Locations**: Number of distinct delivery locations

### 4. **Order Details**
Click any marker to see:
- Customer name
- Full address (formatted)
- Latest order date
- Order status
- Assigned driver (if any)
- Total number of orders at that location
- Order amount

## How to Access

1. Log in as an **admin** user
2. Click on **"Mapa"** in the navigation bar
3. The map will load showing all orders for tomorrow by default

## Prerequisites

### 1. Google Maps API Key
Make sure you have set up the Google Maps API key in your `.env` file:

```env
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

If not configured, follow the setup guide in `GEOCODING_SETUP.md`.

### 2. Geocoded Addresses
For orders to appear on the map, the corresponding user profiles must have:
- `lat` (latitude)
- `lng` (longitude)
- `formatted_address` (optional, for better display)

These fields are populated using the geocoding service. See the AdminTable component for geocoding user addresses.

## Technical Details

### Data Flow
1. Component fetches orders from the `orders` table
2. Joins with `profiles` table using `orders.user_id = profiles.user_id`
3. Filters orders that have valid `lat` and `lng` in the profile
4. Groups orders by location coordinates
5. Displays markers on the map

### Database Schema
The component relies on these fields:

**Orders table:**
- `id`
- `date`
- `status`
- `total`
- `user_id`
- `driver_id`
- `note`
- `paid_by`
- `crateBig`, `crateSmall`
- `crateBigReceived`, `crateSmallReceived`

**Profiles table:**
- `id`
- `full_name`
- `role`
- `address`
- `lat` ⭐
- `lng` ⭐
- `formatted_address`

### Performance
- Limits to 1000 orders per query
- Uses React Query for caching (5-minute stale time)
- Only fetches necessary fields to minimize data transfer
- Query updates automatically when filters change (date, driver, status)

## Usage Tips

1. **Plan Delivery Routes**: Use the driver filter to see all orders assigned to a specific driver for route planning

2. **Track Specific Status**: Filter by status to see orders in a specific stage of processing

3. **Identify Delivery Clusters**: Numbers on markers help identify high-concentration delivery areas

4. **Find Unassigned Orders**: Select "Bez řidiče" (Without driver) to see orders that still need driver assignment

5. **Reset Filters**: Use the "Reset Filters" button to quickly return to default view (tomorrow, all drivers, all statuses)

## Troubleshooting

### Map doesn't load
- Check if `VITE_GOOGLE_MAPS_API_KEY` is set in `.env`
- Verify the API key has Google Maps JavaScript API enabled
- Check browser console for errors

### No markers appear
- Verify that user profiles have been geocoded (have lat/lng values)
- Check if orders exist in the selected time period
- Try resetting filters

### Markers in wrong location
- The geocoding might be inaccurate
- Re-geocode the address in the AdminTable component
- Verify the address format in the profile

## Future Enhancements

Possible improvements for this feature:
- Route optimization for delivery planning
- Heatmap view for delivery density
- Clustering for better performance with many markers
- Export delivery routes
- Color-coded markers by driver
- Real-time order status updates
- Date range selection (from/to dates)
- Driver route comparison

