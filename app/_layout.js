// app/_layout.js

import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { auth } from '../firebase';

export default function Layout() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      SplashScreen.hideAsync();
    });

    return () => unsubscribe();
  }, []);

  return <Stack />;
}
