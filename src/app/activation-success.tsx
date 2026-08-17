import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Tiny Confetti Component for scattered decoration
function ConfettiPiece({ style, color }: { style: any; color: string }) {
  return <View style={[styles.confetti, style, { backgroundColor: color }]} />;
}

export default function ActivationSuccess() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { isAuthenticated } = useAuth();

  const handleAction = () => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scattered Confetti Decoration */}
        <View style={styles.confettiContainer}>
          <ConfettiPiece style={{ top: 20, left: 40, width: 8, height: 12, transform: [{ rotate: '45deg' }] }} color={theme.primary} />
          <ConfettiPiece style={{ top: 60, right: 60, width: 6, height: 14, transform: [{ rotate: '-30deg' }] }} color="#09C487" />
          <ConfettiPiece style={{ top: 120, left: 20, width: 10, height: 6, transform: [{ rotate: '15deg' }] }} color="#09C487" />
          <ConfettiPiece style={{ top: 260, left: 60, width: 8, height: 8, borderRadius: 4 }} color="#09C487" />
          <ConfettiPiece style={{ top: 180, right: 30, width: 8, height: 12, transform: [{ rotate: '60deg' }] }} color={theme.primary} />
          <ConfettiPiece style={{ top: 280, right: 70, width: 10, height: 5, transform: [{ rotate: '-45deg' }] }} color="#09C487" />
          
          {/* Concentric Circle Success Checkmark Badge */}
          <View style={[styles.successRippleOuter, { backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.04)' : '#F3FBF7' }]}>
            <View style={[styles.successRippleMiddle, { backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.08)' : '#E8F7F0' }]}>
              <View style={styles.successRippleInner}>
                <Ionicons name="checkmark" size={60} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </View>

        {/* Text Header */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.text }]}>{t.accountActivatedSuccess}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t.accountActivatedSuccessDesc}
          </Text>
        </View>

        {/* Features list Card */}
        <View style={[styles.featuresCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {/* Feature 1 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="shield-checkmark" size={24} color="#09C487" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: theme.text }]}>{t.accountSecureTitle}</Text>
              <Text style={[styles.featureSubtitle, { color: theme.textSecondary }]}>{t.accountSecureDesc}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Feature 2 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="flash" size={24} color="#09C487" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: theme.text }]}>{t.accessAllFeaturesTitle}</Text>
              <Text style={[styles.featureSubtitle, { color: theme.textSecondary }]}>{t.accessAllFeaturesDesc}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Feature 3 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="person" size={24} color="#09C487" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: theme.text }]}>{t.welcomeNiroPayFeatureTitle}</Text>
              <Text style={[styles.featureSubtitle, { color: theme.textSecondary }]}>{t.welcomeNiroPayFeatureDesc}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          onPress={handleAction}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isAuthenticated ? "arrow-forward-outline" : "log-in-outline"}
            size={24}
            color="#FFFFFF"
            style={styles.loginButtonIcon}
          />
          <Text style={styles.loginButtonText}>
            {isAuthenticated
              ? (language === 'en' ? 'Enter Application' : 'অ্যাপে প্রবেশ করুন')
              : t.goToLogin}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  // Confetti and success icon container
  confettiContainer: {
    width: '100%',
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: Spacing.md,
  },
  confetti: {
    position: 'absolute',
    opacity: 0.8,
  },
  // Success circular badge
  successRippleOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRippleMiddle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRippleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#09C487',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#09C487',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  // Header texts
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  // Features Card
  featuresCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  featureSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  // Sticky Bottom Action
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
  },
  loginButton: {
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
  loginButtonIcon: {
    marginRight: Spacing.sm,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
