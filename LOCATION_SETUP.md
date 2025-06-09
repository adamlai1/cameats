# Location Setup Guide - Getting Real Restaurant Data

The LocationPicker component now supports **real restaurant and location data** using Google Places API instead of mock data.

## Quick Setup (5 minutes)

### 1. Get Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Library**
4. Search for "Places API" and enable it
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **API Key**
7. Copy your API key

### 2. Add API Key to Your App

Open `app/config/config.js` and replace:
```javascript
GOOGLE_PLACES_API_KEY: 'YOUR_GOOGLE_PLACES_API_KEY',
```

With your actual API key:
```javascript
GOOGLE_PLACES_API_KEY: 'AIzaSyC4YourActualAPIKeyHere',
```

### 3. Secure Your API Key (Recommended)

In Google Cloud Console:
1. Go to **APIs & Services** → **Credentials**
2. Click on your API key
3. Under **API restrictions**, select "Restrict key"
4. Enable only: **Places API**
5. Under **Application restrictions**, add your app's bundle ID

## Features You Get with Real Data

✅ **Real restaurants** near user's location  
✅ **Accurate ratings** and reviews  
✅ **Real addresses** and contact info  
✅ **Distance calculations** from user  
✅ **Business hours** and open/closed status  
✅ **Restaurant categories** (Fast Food, Fine Dining, etc.)  
✅ **Search functionality** like Apple Maps  

## Cost Information

- Google Places API has a **free tier**: 
  - First 1000 requests per month are free
  - After that: $17 per 1000 requests
- For a typical food app, this usually stays within free limits
- You can set billing alerts in Google Cloud Console

## Fallback Behavior

If no API key is configured, the app automatically falls back to enhanced mock data, so the app won't break.

## Testing

1. Allow location permissions when prompted
2. Search for "pizza", "sushi", "coffee" etc.
3. You should see real restaurants near your location!

## Troubleshooting

**No results showing up?**
- Check your API key is correct
- Ensure Places API is enabled in Google Cloud Console
- Check the browser/console for error messages

**"API key not configured" warning?**
- Make sure you saved the config.js file
- Restart your Expo development server

Need help? The app logs helpful error messages to guide you through setup! 