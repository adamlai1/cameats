// app/index.js

import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { auth } from '../firebase';

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading CamEats...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Welcome to CamEats!</Text>
      <Link href="/signup" style={{ marginVertical: 10 }}>Sign Up</Link>
      <Link href="/login" style={{ marginVertical: 10 }}>Login</Link>
      <Link href="/post" style={{ marginVertical: 10 }}>Create a Post</Link>
      <Link href="/FeedScreen" style={{ marginVertical: 10 }}>Feed</Link>
      <Link href="/ProfileScreen" style={{ marginVertical: 10 }}>Profile</Link>
    </View>
  );
}
