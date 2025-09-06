interface GeocodingResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id: string;
}

interface GeocodingError {
  error: string;
  message: string;
}

export class GeocodingService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!this.apiKey) {
      console.warn('Google Maps API key not found. Geocoding will not work.');
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult | GeocodingError> {
    if (!this.apiKey) {
      return {
        error: 'API_KEY_MISSING',
        message: 'Google Maps API key is not configured'
      };
    }

    if (!address || address.trim() === '') {
      return {
        error: 'INVALID_ADDRESS',
        message: 'Address is required'
      };
    }

    try {
      const encodedAddress = encodeURIComponent(address.trim());
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formatted_address: result.formatted_address,
          place_id: result.place_id
        };
      } else {
        return {
          error: data.status,
          message: data.error_message || 'Geocoding failed'
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return {
        error: 'NETWORK_ERROR',
        message: 'Failed to connect to Google Geocoding API'
      };
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | GeocodingError> {
    if (!this.apiKey) {
      return {
        error: 'API_KEY_MISSING',
        message: 'Google Maps API key is not configured'
      };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formatted_address: result.formatted_address,
          place_id: result.place_id
        };
      } else {
        return {
          error: data.status,
          message: data.error_message || 'Reverse geocoding failed'
        };
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        error: 'NETWORK_ERROR',
        message: 'Failed to connect to Google Geocoding API'
      };
    }
  }
}

// Create a singleton instance
export const geocodingService = new GeocodingService();
