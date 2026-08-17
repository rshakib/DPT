import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { BottomSkylineSvg } from '../components/BottomSkylineSvg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

const { width } = Dimensions.get('window');

export default function Cashout() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  const handleBackToDashboard = () => {
    // Replace the navigation stack to return cleanly to dashboard
    router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.cashOutTitle} />

      <View style={styles.contentContainer}>
        {/* Centered Information Block */}
        <View style={styles.centerBlock}>
          <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="business" size={48} color={theme.primary} />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            </View>
          </View>
          
          <Text style={[styles.heading, { color: theme.text }]}>{t.cashOutTitle}</Text>
          
          <Text style={[styles.messageText, { color: theme.textSecondary }]}>
            {t.cashOutUnavailableDesc}
          </Text>
        </View>

        {/* Action Button Container */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            onPress={handleBackToDashboard}
            activeOpacity={0.8}
          >
            <Ionicons name="home-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>{t.backToDashboard}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Skyline footer illustration in brand color */}
      <BottomSkylineSvg color={theme.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
    zIndex: 1,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: Spacing.xl,
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FF9500',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  messageText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: Spacing.md,
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: Spacing.md,
  },
  primaryButton: {
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
});
