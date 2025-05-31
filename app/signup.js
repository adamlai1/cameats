// app/signup.js

import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, db } from '../firebase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const router = useRouter();
  
  const handleSignup = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        username,
        displayName,
        email,
        bio: '',
        friends: [],
        friendRequests: [],
        createdAt: new Date(),
      });

      Alert.alert('Signup successful!');
      router.replace('/tabs/FeedScreen');
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput 
          placeholder="Enter your full name" 
          value={displayName} 
          onChangeText={setDisplayName} 
          style={styles.input}
          autoCapitalize="words"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Username</Text>
        <TextInput 
          placeholder="Choose a username" 
          value={username} 
          onChangeText={setUsername} 
          style={styles.input}
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
      </View>

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
          placeholder="Choose a password (min. 6 characters)" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
          style={styles.input}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Sign Up" onPress={handleSignup} />
        <Button title="Already have an account?" onPress={() => router.replace('/login')} />
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
