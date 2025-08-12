// app/index.js

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // If user is authenticated, redirect immediately
    if (!loading && user) {
      router.replace('/tabs');
    }
  }, [user, loading, router]);

  // Don't render anything while loading or if user is authenticated
  if (loading || user) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to CamEats!</Text>
      <View style={styles.buttonContainer}>
        <Button title="Login" onPress={() => router.replace('/login')} />
        <Button title="Create Account" onPress={() => router.replace('/signup')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  title: {
    fontSize: 24,
    marginBottom: 20
  },
  buttonContainer: {
    width: '80%',
    gap: 10
  }
});
