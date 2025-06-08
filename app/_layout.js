// app/_layout.js

import { Stack, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../app/contexts/AuthContext';
import { auth } from '../firebase';

// Import bread images
const breadNormal = require('../assets/images/bread-normal.png');
const breadBitten = require('../assets/images/bread-bitten.png');

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    // Load bread images in the background
    Image.prefetch(Image.resolveAssetSource(breadNormal).uri).catch(err => 
      console.warn('Failed to preload normal bread:', err)
    );
    Image.prefetch(Image.resolveAssetSource(breadBitten).uri).catch(err => 
      console.warn('Failed to preload bitten bread:', err)
    );

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        router.replace('/tabs/FeedScreen');
      } else {
        // No user is signed in
        router.replace('/');
      }
    });

    return () => unsubscribe();
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
          name="tabs"
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
      <RootLayoutNav />
    </AuthProvider>
  );
}
