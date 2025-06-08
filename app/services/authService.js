import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../firebase';

const USER_TOKEN_KEY = '@user_token';
const USER_DATA_KEY = '@user_data';

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store user token
    await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid);
    
    // Store basic user data
    const userData = {
      uid: user.uid,
      email: user.email,
      lastLoginAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    
    return user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    // Clear stored user data
    await AsyncStorage.multiRemove([USER_TOKEN_KEY, USER_DATA_KEY]);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const userToken = await AsyncStorage.getItem(USER_TOKEN_KEY);
    if (!userToken) return null;
    
    const userDataString = await AsyncStorage.getItem(USER_DATA_KEY);
    return userDataString ? JSON.parse(userDataString) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const isUserLoggedIn = async () => {
  const user = await getCurrentUser();
  return !!user;
}; 