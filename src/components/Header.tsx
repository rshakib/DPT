import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, findNodeHandle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function Header({ title, showBackButton = true, onBackPress }: HeaderProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const headerRef = React.useRef<View>(null);

  React.useEffect(() => {
    const nodeTag = headerRef.current ? findNodeHandle(headerRef.current) : null;
    console.log(`[DPT_NATIVE_TRACE][MOUNT] component=Header title="${title}" nativeTag=${nodeTag} timestamp=${Date.now()}`);
    return () => {
      console.log(`[DPT_NATIVE_TRACE][UNMOUNT] component=Header title="${title}" nativeTag=${nodeTag} timestamp=${Date.now()}`);
    };
  }, [title]);

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View ref={headerRef} style={[styles.container, { backgroundColor: theme.background }]}>
      {showBackButton ? (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {title ? (
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}

      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 40,
  },
});
