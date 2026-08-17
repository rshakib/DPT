import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import * as LocalAuthentication from 'expo-local-authentication';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { useAppLock } from '../context/AppLockContext';
import * as api from '../services/api';
import { saveLocalPinHash } from '../utils/security';

const { width } = Dimensions.get('window');

type AuthStatus = 'idle' | 'checking' | 'authenticating' | 'success' | 'failed' | 'not-supported' | 'not-enrolled';

export default function BiometricEnrollment() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { login } = useAuth();
  const { unlock } = useAppLock();

  // Retrieve passed parameters from previous screen
  const params = useLocalSearchParams();
  const { nid = '', activationCode = '', username = '', password = '', fullName = '' } = params;

  // Biometrics State
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scanner Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start continuous loop scale animation for pulsing fingerprint
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Trigger biometric authentication on mount after a minor delay
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerBiometrics();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const triggerBiometrics = async () => {
    try {
      setErrorMessage(null);
      setAuthStatus('checking');

      // 1. Check if hardware is available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setAuthStatus('not-supported');
        setErrorMessage(t.biometricHardwareError);
        return;
      }

      // 2. Check if biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setAuthStatus('not-enrolled');
        setErrorMessage(t.biometricEnrolledError);
        return;
      }

      // 3. Authenticate
      setAuthStatus('authenticating');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.biometricAuthPrompt,
        fallbackLabel: t.usePasscode,
        disableDeviceFallback: false,
      });

      if (result.success) {
        setAuthStatus('success');
        // Wait 1 second before proceeding so user sees the success feedback
        setTimeout(() => {
          navigateToNextScreen();
        }, 1000);
      } else {
        setAuthStatus('failed');
        // Handle cancellation vs failure
        if (result.error === 'user_cancel' || result.error === 'system_cancel') {
          setErrorMessage(t.authCancelledRetry);
        } else {
          setErrorMessage(t.authFailedRetry);
        }
      }
    } catch (error: any) {
      setAuthStatus('failed');
      setErrorMessage(error.message || t.authFailedRetry);
    }
  };

  const navigateToNextScreen = () => {
    router.push({
      pathname: '/activation-success',
      params: {
        nid: String(nid),
        activationCode: String(activationCode),
        username: String(username),
        fullName: String(fullName),
      },
    });
  };

  const handleContinueFallback = () => {
    navigateToNextScreen();
  };

  const handleBack = () => {
    router.back();
  };

  // Determine colors based on authentication status
  const getRingColor = () => {
    if (authStatus === 'success') return theme.success;
    if (authStatus === 'failed') return theme.error;
    return theme.primary;
  };

  const getFingerprintColor = () => {
    if (authStatus === 'success') return theme.success;
    if (authStatus === 'failed') return theme.error;
    return theme.primary;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.biometricEnrollmentTitle} onBackPress={handleBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Touch-Responsive Scanner Component */}
        <View style={styles.scannerOuterContainer}>
          <Pressable 
            onPress={triggerBiometrics}
            style={({ pressed }) => [
              styles.scannerCircle,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed && styles.scannerCirclePressed,
            ]}
          >
            {/* Circular Progress Ring using SVG */}
            <Svg width={240} height={240} viewBox="0 0 200 200" style={styles.svgRing}>
              {/* Background Light Ring */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke={authStatus === 'failed' ? (isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFE8E8') : (authStatus === 'success' ? (isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#E6FFF2') : theme.border)}
                strokeWidth="4"
                fill="transparent"
              />
              {/* Progress highlighted Ring */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke={getRingColor()}
                strokeWidth="5"
                fill="transparent"
                strokeDasharray="565.48"
                strokeDashoffset={authStatus === 'success' ? '0' : '180'} // Fully completed if success
                strokeLinecap="round"
                transform="rotate(-90, 100, 100)"
              />
            </Svg>

            {/* Scanning Brackets corners */}
            <View style={[styles.bracket, styles.bracketTopLeft, { borderColor: theme.border }]} />
            <View style={[styles.bracket, styles.bracketTopRight, { borderColor: theme.border }]} />
            <View style={[styles.bracket, styles.bracketBottomLeft, { borderColor: theme.border }]} />
            <View style={[styles.bracket, styles.bracketBottomRight, { borderColor: theme.border }]} />

            {/* Dynamic Fingerprint or Check/Close Icon */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              {authStatus === 'success' ? (
                <Ionicons name="checkmark-circle-outline" size={90} color={theme.success} />
              ) : authStatus === 'failed' ? (
                <Ionicons name="alert-circle-outline" size={90} color={theme.error} />
              ) : (
                <Ionicons name="finger-print" size={88} color={getFingerprintColor()} />
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* Scan Status Feedback */}
        <View style={styles.statusContainer}>
          {authStatus === 'checking' && <Text style={[styles.statusChecking, { color: theme.textSecondary }]}>{t.checkingUsername}</Text>}
          {authStatus === 'authenticating' && <Text style={[styles.statusScanning, { color: theme.primary }]}>{t.biometricAuthPrompt}</Text>}
          {authStatus === 'success' && <Text style={[styles.statusSuccess, { color: theme.success }]}>{t.verifySuccessful}</Text>}
          {authStatus === 'failed' && <Text style={[styles.statusFailed, { color: theme.error }]}>{t.scanFailedRetry}</Text>}
          {errorMessage && <Text style={styles.errorBannerText}>{errorMessage}</Text>}
        </View>

        {/* Informative Header */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.text }]}>{t.letSetupFingerprint}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t.placeFingerScanner}
          </Text>
        </View>

        {/* Security badges box */}
        <View style={[styles.badgesCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.badgeColumn}>
            <Ionicons name="shield-checkmark-outline" size={24} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.text }]}>{t.secureLabel}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.badgeColumn}>
            <Ionicons name="flash-outline" size={24} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.text }]}>{t.fastAccessLabel}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.badgeColumn}>
            <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.text }]}>{t.privateLabel}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          onPress={handleContinueFallback}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>{t.continueButton}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLinkButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.backLinkText, { color: theme.primary }]}>{t.back}</Text>
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
    paddingBottom: Spacing.xl,
  },
  // Scanner Visuals
  scannerOuterContainer: {
    marginVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: 260,
    height: 260,
  },
  scannerCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  scannerCirclePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  svgRing: {
    position: 'absolute',
  },
  // Brackets around fingerprint
  bracket: {
    position: 'absolute',
    width: 22,
    height: 22,
  },
  bracketTopLeft: {
    top: 50,
    left: 50,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderTopLeftRadius: 6,
  },
  bracketTopRight: {
    top: 50,
    right: 50,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderTopRightRadius: 6,
  },
  bracketBottomLeft: {
    bottom: 50,
    left: 50,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 6,
  },
  bracketBottomRight: {
    bottom: 50,
    right: 50,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomRightRadius: 6,
  },
  // Status feedback styling
  statusContainer: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  statusChecking: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusScanning: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusSuccess: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusFailed: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorBannerText: {
    fontSize: 13,
    color: '#8A86A8',
    textAlign: 'center',
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  // Texts
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Badges Card
  badgesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xs,
  },
  badgeColumn: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 40,
  },
  // Sticky Bottom Actions
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  continueButton: {
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backLinkButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
