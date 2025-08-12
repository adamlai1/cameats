import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const themes = {
  light: {
    // Background colors
    background: '#fff',
    surface: '#fff',
    surfaceSecondary: '#f5f5f5',
    modal: '#fff',
    
    // Text colors
    text: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    
    // UI colors
    border: '#e1e1e1',
    borderLight: '#f0f0f0',
    inputBackground: '#f0f0f0',
    placeholder: '#999',
    
    // Action colors
    primary: '#007AFF',
    accent: '#1976d2',
    success: '#34C759',
    danger: '#ff3b30',
    warning: '#ff9500',
    
    // Special colors
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: '#000',
    
    // Tab bar
    tabBarBackground: '#fff',
    tabBarInactive: '#666',
    tabBarActive: '#007AFF'
  },
  dark: {
    // Background colors
    background: '#0b0b0c',
    surface: '#121214',
    surfaceSecondary: '#18181b',
    modal: '#121214',
    
    // Text colors
    text: '#eaeaec',
    textSecondary: '#9a9aa1',
    textTertiary: '#6e6e75',
    
    // UI colors
    border: '#26262a',
    borderLight: '#1e1e22',
    inputBackground: '#18181b',
    placeholder: '#7c7c82',
    
    // Action colors
    primary: '#3ea6ff',
    accent: '#7db9ff',
    success: '#34C759',
    danger: '#ff453a',
    warning: '#ff9f0a',
    
    // Special colors
    overlay: 'rgba(0, 0, 0, 0.85)',
    shadow: '#000',
    
    // Tab bar
    tabBarBackground: '#121214',
    tabBarInactive: '#9a9aa1',
    tabBarActive: '#7db9ff'
  }
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('light'); // 'light' or 'dark' only
  const [currentTheme, setCurrentTheme] = useState(themes.light);

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    updateTheme();
  }, [themeMode]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const updateTheme = () => {
    const theme = themeMode === 'dark' ? themes.dark : themes.light;
    setCurrentTheme(theme);
  };

  const setTheme = async (mode) => {
    try {
      await AsyncStorage.setItem('themeMode', mode);
      setThemeMode(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const value = {
    theme: currentTheme,
    themeMode,
    setTheme,
    isDark: currentTheme === themes.dark
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 