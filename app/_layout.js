// app/_layout.js

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Image, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './contexts/AuthContext';
import { CatProvider } from './contexts/CatContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Import bread images
const breadNormal = require('../assets/images/bread-normal.png');
const breadBitten = require('../assets/images/bread-bitten.png');

function RootLayoutNav() {
  useEffect(() => {
    // Synchronously resolve images to avoid any delays
    const preloadImages = () => {
      try {
        // Resolve bread images synchronously for immediate availability
        const breadNormalSource = Image.resolveAssetSource(breadNormal);
        const breadBittenSource = Image.resolveAssetSource(breadBitten);
        
        // Force immediate cache of image sources
        Image.prefetch(breadNormalSource.uri);
        Image.prefetch(breadBittenSource.uri);
        
        console.log('Bread images cached immediately');
      } catch (error) {
        console.warn('Failed to cache bread images:', error);
      }
    };

    // Start synchronously - no async delays
    preloadImages();

    // Globally suppress VirtualizedLists warnings
    LogBox.ignoreLogs([
      'VirtualizedLists should never be nested inside plain ScrollViews',
      'VirtualizedLists should never be nested',
      'VirtualizedList',
      'ScrollView',
      'windowing and other functionality'
    ]);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="signup"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="tabs/index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="FriendProfile"
          options={{
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CatProvider>
          <RootLayoutNav />
        </CatProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
