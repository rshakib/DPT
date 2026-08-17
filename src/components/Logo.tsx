import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

interface LogoProps {
  size?: number;
}

/**
 * Official DPT Brand Logo from assets/dpt new.png
 */
export function LogoMark({ size = 56 }: LogoProps) {
  return (
    <Image
      source={require('../../assets/dpt new.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
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

