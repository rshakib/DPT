import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { LogoMark } from '../components/Logo';

const { width } = Dimensions.get('window');

export default function ActivationStart() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Subtle Background Decorative Blobs */}
      <View style={[styles.bgBlobTopLeft, { backgroundColor: theme.primaryLight }]} />
      <View style={[styles.bgBlobCenter, { backgroundColor: isDarkMode ? 'rgba(88, 62, 242, 0.05)' : '#F8F6FF' }]} />

      {/* Top Header - Logo and Slogan */}
      <View style={styles.headerContainer}>
        <View style={styles.logoRow}>
          <LogoMark size={42} />
          <Text style={[styles.logoText, { color: theme.text }]}>
            D<Text style={[styles.logoTextAccent, { color: theme.primary }]}>PT</Text>
          </Text>
        </View>
        <View style={styles.sloganRow}>
          <View style={[styles.sloganLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.sloganText, { color: theme.textSecondary }]}>Digital Pocket Transaction</Text>
          <View style={[styles.sloganLine, { backgroundColor: theme.border }]} />
        </View>
      </View>

      {/* Middle Onboarding Illustration */}
      <View style={styles.illustrationContainer}>
        <Image
          source={require('../../assets/images/onboarding_illustration.jpg')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      {/* Bottom Text and Actions */}
      <View style={styles.bottomContainer}>
        <Text style={[styles.welcomeTitle, { color: theme.text }]}>{t.welcomeNiroPay}</Text>
        <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
          {t.welcomeSubtitleOnboarding}
        </Text>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          activeOpacity={0.8}
          onPress={() => router.push('/officer-verify')}
        >
          <View style={styles.buttonLeftContent}>
            <View style={styles.iconContainerPrimary}>
              <Ionicons name="ticket-outline" size={24} color="#FFF" />
            </View>
            <Text style={styles.primaryButtonText}>{t.haveActivationCode}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFF" />
        </TouchableOpacity>

        {/* Secondary Action Button */}
        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: theme.background, borderColor: theme.primary }]}
          activeOpacity={0.8}
          onPress={() => router.push('/login')}
        >
          <View style={styles.buttonLeftContent}>
            <View style={styles.iconContainerSecondary}>
              <Ionicons name="person-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>{t.alreadyRegistered}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // Background styling
  bgBlobTopLeft: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.6,
    zIndex: -1,
  },
  bgBlobCenter: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.8,
    zIndex: -1,
  },
  // Header section
  headerContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoTextAccent: {},
  sloganRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  sloganLine: {
    width: 24,
    height: 1,
  },
  sloganText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Illustration section
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.lg,
  },
  illustration: {
    width: width * 0.85,
    height: width * 0.85,
  },
  // Bottom content section
  bottomContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  // Buttons
  primaryButton: {
    height: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconContainerPrimary: {
    width: 36,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 64,
    borderWidth: 1.5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  iconContainerSecondary: {
    width: 36,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
