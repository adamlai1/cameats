// app/_layout.js

import { Stack, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../firebase';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
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
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen 
          name="tabs" 
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
