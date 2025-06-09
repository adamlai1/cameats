// app/config/config.js

export const config = {
  // Google Places API configuration
  // To get real location data, you need to:
  // 1. Go to Google Cloud Console (https://console.cloud.google.com/)
  // 2. Create a new project or select existing one
  // 3. Enable the Places API
  // 4. Create credentials (API Key)
  // 5. Replace the value below with your API key
  
  GOOGLE_PLACES_API_KEY: 'YOUR_GOOGLE_PLACES_API_KEY',
  
  // Optional: Restrict API key to specific app bundle ID for security
  // Set this in Google Cloud Console under API Key restrictions
  
  // Location search settings
  SEARCH_RADIUS: 5000, // 5km radius for nearby search
  MAX_RESULTS: 20,     // Maximum number of results to show
  
  // Development mode - set to true to see detailed logs
  DEV_MODE: __DEV__
}; 