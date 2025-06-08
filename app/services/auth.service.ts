import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    User,
    UserCredential
} from 'firebase/auth';
import { auth } from '../../firebase';

// Constants for secure storage
const AUTH_TOKEN_KEY = '@auth_token';
const USER_DATA_KEY = '@user_data';
const PERSIST_LOGIN_KEY = '@persist_login';

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private persistLogin: boolean = false;

  private constructor() {
    // Initialize auth state listener
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user) {
        await this.setSecureToken(user);
        const persistLogin = await AsyncStorage.getItem(PERSIST_LOGIN_KEY);
        this.persistLogin = persistLogin === 'true';
      }
    });

    // Initialize persistence state
    this.initializePersistence();
  }

  private async initializePersistence() {
    try {
      const [persistLogin, storedUser] = await Promise.all([
        AsyncStorage.getItem(PERSIST_LOGIN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY)
      ]);

      this.persistLogin = persistLogin === 'true';

      // If we have stored user data and persistence is enabled, try to restore the session
      if (this.persistLogin && storedUser) {
        const userData = JSON.parse(storedUser);
        if (!this.currentUser && userData) {
          this.currentUser = auth.currentUser;
        }
      }
    } catch (error) {
      console.error('Error initializing persistence state:', error);
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Register new user
  async register(email: string, password: string, shouldPersist: boolean = false): Promise<UserCredential> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await this.setPersistence(shouldPersist);
      await this.setSecureToken(userCredential.user);
      return userCredential;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Login existing user
  async login(email: string, password: string, shouldPersist: boolean = false): Promise<UserCredential> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await this.setPersistence(shouldPersist);
      await this.setSecureToken(userCredential.user);
      return userCredential;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      await this.clearSecureStorage();
      await signOut(auth);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Update password
  async updateUserPassword(newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user is currently signed in');
      await updatePassword(user, newPassword);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser || auth.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!(this.currentUser || auth.currentUser);
  }

  // Get persistence state
  isPersistenceEnabled(): boolean {
    return this.persistLogin;
  }

  // Set persistence state
  private async setPersistence(shouldPersist: boolean): Promise<void> {
    try {
      this.persistLogin = shouldPersist;
      await AsyncStorage.setItem(PERSIST_LOGIN_KEY, shouldPersist.toString());
    } catch (error) {
      console.error('Error setting persistence:', error);
      throw error;
    }
  }

  // Initialize stored session
  async initializeStoredSession(): Promise<User | null> {
    try {
      const [persistLogin, storedUser] = await Promise.all([
        AsyncStorage.getItem(PERSIST_LOGIN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY)
      ]);

      if (persistLogin !== 'true' || !storedUser) {
        return null;
      }

      const userData = JSON.parse(storedUser);
      return userData;
    } catch (error) {
      console.error('Error initializing stored session:', error);
      return null;
    }
  }

  // Private helper methods
  private async setSecureToken(user: User): Promise<void> {
    try {
      const token = await user.getIdToken(true); // Force refresh the token
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL
      }));
    } catch (error) {
      console.error('Error storing auth token:', error);
      throw error;
    }
  }

  private async clearSecureStorage(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY, PERSIST_LOGIN_KEY]);
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      throw error;
    }
  }

  private handleAuthError(error: any): Error {
    console.error('Authentication error:', error);
    
    const errorMessages: { [key: string]: string } = {
      'auth/email-already-in-use': 'This email is already registered',
      'auth/invalid-email': 'Invalid email address',
      'auth/operation-not-allowed': 'Operation not allowed',
      'auth/weak-password': 'Password is too weak',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
    };

    return new Error(errorMessages[error.code] || error.message || 'Authentication error occurred');
  }
}

export default AuthService.getInstance(); 