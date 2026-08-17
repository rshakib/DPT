import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';

interface LogoProps {
  size?: number;
}

/**
 * Modern digital wallet / secure card vector icon for DPT
 */
export function LogoMark({ size = 48 }: LogoProps) {
  const { theme } = useAppTheme();
  const gradStart = theme.gradient[0] || theme.primary;
  const gradEnd = theme.gradient[1] || theme.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="dptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={gradStart} />
          <Stop offset="100%" stopColor={gradEnd} />
        </LinearGradient>
      </Defs>
      {/* Wallet / Pocket body */}
      <Rect
        x="12"
        y="22"
        width="76"
        height="56"
        rx="16"
        stroke="url(#dptGrad)"
        strokeWidth="7"
      />
      {/* Pocket Flap / Card Notch */}
      <Path
        d="M12 42C30 42 35 34 50 34C65 34 70 42 88 42"
        stroke="url(#dptGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Fast Transfer Lightning / Chip Token */}
      <Circle cx="64" cy="54" r="7" fill="url(#dptGrad)" />
      <Path
        d="M32 54H48"
        stroke="url(#dptGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Full DPT Brand Header with Name & Slogan
 */
export function DptBrandHeader({ showSlogan = true }: { showSlogan?: boolean }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.brandContainer}>
      <Text style={[styles.brandTitle, { color: theme.text }]}>
        D<Text style={{ color: theme.primary }}>PT</Text>
      </Text>
      {showSlogan && (
        <Text style={[styles.brandSlogan, { color: theme.textSecondary }]}>
          Digital Pocket Transaction
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  brandContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandSlogan: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

