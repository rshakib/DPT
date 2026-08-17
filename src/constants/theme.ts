import { Platform } from 'react-native';

export const Colors = {
  // Brand colors
  primary: '#583EF2',
  primaryLight: '#EBE8FF',
  textDark: '#0E0D2C',
  textGrey: '#7E7C9D',
  background: '#FFFFFF',
  success: '#09C487',
  error: '#FF3838',
  white: '#FFFFFF',
  lightGray: '#F4F3F8',
  border: '#E2E0EE',
  cardBg: '#FFFFFF',

  // Classic Theme (Purple)
  classic: {
    light: {
      primary: '#583EF2',
      primaryLight: '#EBE8FF',
      gradient: ['#583EF2', '#8F78FF'] as const,
      text: '#0E0D2C',
      textSecondary: '#7E7C9D',
      background: '#FFFFFF',
      backgroundElement: '#F4F3F8',
      backgroundSelected: '#EBE8FF',
      success: '#09C487',
      error: '#FF3838',
      border: '#E2E0EE',
      cardBg: '#FFFFFF',
      textDark: '#0E0D2C',
    },
    dark: {
      primary: '#583EF2',
      primaryLight: '#2C2754',
      gradient: ['#583EF2', '#8F78FF'] as const,
      text: '#FFFFFF',
      textSecondary: '#A5A3C1',
      background: '#121212',
      backgroundElement: '#1E1E1E',
      backgroundSelected: '#2C2754',
      success: '#09C487',
      error: '#FF3838',
      border: '#2A2A2A',
      cardBg: '#1E1E1E',
      textDark: '#FFFFFF',
    },
  },

  // Sol Theme (Enterprise Orange & Charcoal)
  sol: {
    light: {
      primary: '#FF6B00', // Sol Vibrant Orange
      primaryLight: '#FFF0E5',
      gradient: ['#FF6B00', '#FF8533'] as const,
      text: '#1C1D21', // Charcoal Black
      textSecondary: '#666970',
      background: '#FFFFFF',
      backgroundElement: '#F7F7F8',
      backgroundSelected: '#FFF0E5',
      success: '#10B981', // Clean Emerald Green
      error: '#EF4444',
      border: '#E5E7EB', // Minimal Light Gray
      cardBg: '#FFFFFF',
      textDark: '#1C1D21',
    },
    dark: {
      primary: '#FF6B00',
      primaryLight: '#3D1C05',
      gradient: ['#FF6B00', '#FF8533'] as const,
      text: '#F9FAFB',
      textSecondary: '#9CA3AF',
      background: '#111215',
      backgroundElement: '#1A1B20',
      backgroundSelected: '#3D1C05',
      success: '#10B981',
      error: '#EF4444',
      border: '#2B2D35',
      cardBg: '#1A1B20',
      textDark: '#F9FAFB',
    },
  },

  // Legacy fallback pointers matching Classic Light
  light: {
    primary: '#583EF2',
    primaryLight: '#EBE8FF',
    text: '#0E0D2C',
    textSecondary: '#7E7C9D',
    background: '#FFFFFF',
    backgroundElement: '#F4F3F8',
    backgroundSelected: '#EBE8FF',
    success: '#09C487',
    error: '#FF3838',
    border: '#E2E0EE',
    cardBg: '#FFFFFF',
    textDark: '#0E0D2C',
  },
  dark: {
    primary: '#583EF2',
    primaryLight: '#2C2754',
    text: '#FFFFFF',
    textSecondary: '#A5A3C1',
    background: '#121212',
    backgroundElement: '#1E1E1E',
    backgroundSelected: '#2C2754',
    success: '#09C487',
    error: '#FF3838',
    border: '#2A2A2A',
    cardBg: '#1E1E1E',
    textDark: '#FFFFFF',
  }
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    sansBold: 'System',
    sansSemiBold: 'System',
  },
  android: {
    sans: 'sans-serif',
    sansBold: 'sans-serif-condensed',
    sansSemiBold: 'sans-serif-medium',
  },
  default: {
    sans: 'normal',
    sansBold: 'normal',
    sansSemiBold: 'normal',
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const MaxContentWidth = 800;
