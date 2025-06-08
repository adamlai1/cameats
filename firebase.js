// firebase.js
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Your Firebase config here...

const firebaseConfig = {
  apiKey: "AIzaSyD3MchOKb7Da0hJPSPPf0QXQUgl5p5LXHI",
  authDomain: "cameats-a739f.firebaseapp.com",
  projectId: "cameats-a739f",
  storageBucket: "cameats-a739f.firebasestorage.app",
  messagingSenderId: "596898851005",
  appId: "1:596898851005:web:ae33a76444b74c249f6fd4",
  measurementId: "G-TP8CC5VK0J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Export Firestore and Storage
export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);