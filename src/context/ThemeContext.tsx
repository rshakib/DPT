import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';

export type ActiveThemeName = 'classic' | 'sol';

const THEME_MODE_KEY = 'niropay_theme_mode';

interface ThemeContextType {
  theme: typeof Colors.classic.light;
  activeThemeName: ActiveThemeName;
  isDarkMode: boolean;
  setThemeName: (name: ActiveThemeName) => Promise<void>;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeThemeName, setActiveThemeNameState] = useState<ActiveThemeName>('sol');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    async function loadThemePreference() {
      try {
        const storedTheme = await SecureStore.getItemAsync(THEME_MODE_KEY);
        if (storedTheme === 'sol' || storedTheme === 'classic') {
          setActiveThemeNameState(storedTheme as ActiveThemeName);
        } else if (storedTheme === 'solshare') {
          // Automatic migration for existing users who selected 'solshare'
          setActiveThemeNameState('sol');
          await SecureStore.setItemAsync(THEME_MODE_KEY, 'sol');
        }
      } catch (e) {
        console.warn('Failed to load theme preference from SecureStore:', e);
      }
    }
    loadThemePreference();
  }, []);

  const setThemeName = async (name: ActiveThemeName) => {
    setActiveThemeNameState(name);
    try {
      await SecureStore.setItemAsync(THEME_MODE_KEY, name);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const selectedPalette = Colors[activeThemeName] || Colors.classic;
  const theme = isDarkMode ? selectedPalette.dark : selectedPalette.light;

  return (
    <ThemeContext.Provider
      value={{
        theme: theme as any,
        activeThemeName,
        isDarkMode,
        setThemeName,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
