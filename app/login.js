// app/login.js

import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert('Login successful!');
      router.replace('/tabs/FeedScreen');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput 
          placeholder="Enter your email" 
          value={email} 
          onChangeText={setEmail} 
          keyboardType="email-address" 
          style={styles.input}
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput 
          placeholder="Enter your password" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
          style={styles.input}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Login" onPress={handleLogin} />
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
    padding: 20,
    backgroundColor: '#fff'
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#000'
  },
  inputContainer: {
    width: '80%',
    marginBottom: 15
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
    fontWeight: '500'
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    fontSize: 16,
    backgroundColor: '#f8f8f8',
    color: '#000'
  },
  buttonContainer: {
    marginTop: 20,
    width: '80%',
    gap: 10
  }
});
