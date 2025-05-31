// app/index.js

import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const router = useRouter();

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
