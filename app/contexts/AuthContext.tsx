import { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../../firebase';
import AuthService from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPersistent: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersistent, setIsPersistent] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        // Check for stored session
        const storedUser = await AuthService.initializeStoredSession();
        if (storedUser) {
          setUser(storedUser);
          setIsPersistent(true);
        }

        // Listen for auth state changes
        unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            // Check persistence setting
            const isPersistEnabled = AuthService.isPersistenceEnabled();
            setIsPersistent(isPersistEnabled);
          } else {
            setUser(null);
            setIsPersistent(false);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      await AuthService.login(email, password, rememberMe);
      setIsPersistent(rememberMe);
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      await AuthService.register(email, password, rememberMe);
      setIsPersistent(rememberMe);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      setIsPersistent(false);
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await AuthService.resetPassword(email);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    isPersistent,
    login,
    register,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 