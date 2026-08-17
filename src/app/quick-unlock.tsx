import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { useAppLock } from '../context/AppLockContext';
import { LogoMark } from '../components/Logo';
import { verifyPinLocally } from '../utils/security';

type UnlockStep = 'pin' | 'biometric' | 'unlocked';

export default function QuickUnlock() {
  const { theme, isDarkMode } = useAppTheme();
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];

  const { user, lastLoggedInUser, login, logout, switchAccount } = useAuth();
  const { unlock } = useAppLock();

  const [step, setStep] = useState<UnlockStep>('pin');
  const [pin, setPin] = useState('');
  const [isPinVerifying, setIsPinVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Biometrics States
  const [hasBiometricHardware, setHasBiometricHardware] = useState(true);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(true);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    checkBiometricsSupport();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Biometrics Pulse Animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (step === 'biometric') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [pulseAnim, step]);

  const checkBiometricsSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      setHasBiometricHardware(hasHardware);
      if (!hasHardware) return;

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricEnrolled(isEnrolled);
    } catch (err) {
      setHasBiometricHardware(false);
    }
  };

  // Step 1: User enters 8-digit PIN
  const handleNumPress = async (num: number) => {
    if (step !== 'pin' || isPinVerifying) return;
    if (pin.length < 8) {
      const nextPin = pin + num;
      setPin(nextPin);
      setPinError(null);

      if (nextPin.length === 8) {
        setIsPinVerifying(true);
        const username = user?.username || lastLoggedInUser || '';
        const result = await verifyPinLocally(username, nextPin);

        if (!isMounted.current) return;
        setIsPinVerifying(false);

        if (result.success) {
          // PIN verified -> proceed to Biometrics step
          if (hasBiometricHardware && isBiometricEnrolled) {
            setStep('biometric');
            triggerBiometricAuth();
          } else {
            // If biometrics not available on device -> unlock
            unlock();
          }
        } else {
          setPinError(result.message || (language === 'en' ? 'Incorrect PIN' : 'ভুল পিন'));
          setPin('');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step !== 'pin' || isPinVerifying) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setPinError(null);
    }
  };

  // Step 2: Biometric Authentication (Triggered after successful PIN)
  const triggerBiometricAuth = async () => {
    if (!hasBiometricHardware || !isBiometricEnrolled) {
      unlock();
      return;
    }

    try {
      if (!isMounted.current) return;
      setBiometricError(null);
      setIsBiometricAuthenticating(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.verifyBiometricIdentityMsg || (language === 'en' ? 'Scan fingerprint to finish unlocking' : 'আনলক নিশ্চিত করতে বায়োমেট্রিক দিন'),
        fallbackLabel: t.usePinInsteadMsg || 'Cancel',
        disableDeviceFallback: false,
      });

      if (!isMounted.current) return;
      setIsBiometricAuthenticating(false);

      if (result.success) {
        setStep('unlocked');
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            if (!isMounted.current) return;
            unlock();
          }, 300);
        });
      } else {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          setBiometricError(result.error || (language === 'en' ? 'Biometric scan failed. Tap to try again.' : 'বায়োমেট্রিক মেলেনি, পুনরায় চেষ্টা করুন।'));
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        setIsBiometricAuthenticating(false);
        setBiometricError(err.message || (language === 'en' ? 'Authentication error' : 'ত্রুটি ঘটেছে'));
      }
    }
  };

  const handleSwitchAccount = async () => {
    await switchAccount();
  };

  const handleLogout = async () => {
    await logout();
  };

  const displayName = user?.name || user?.username || lastLoggedInUser || (language === 'en' ? 'User' : 'গ্রাহক');
  const maskedPhone = user?.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
  const dotsArray = Array.from({ length: 8 });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0E0D2C' : '#FAF9FF' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} removeClippedSubviews={false}>
        {/* Header Bar: Language Switcher */}
        <View style={styles.topBar}>
          <View style={styles.languageToggle}>
            <TouchableOpacity
              onPress={() => toggleLanguage('en')}
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleLanguage('bn')}
              style={[styles.langBtn, language === 'bn' && styles.langBtnActive]}
            >
              <Text style={[styles.langText, language === 'bn' && styles.langTextActive]}>বাংলা</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logo Section */}
        <View style={styles.logoSection}>
          <LogoMark size={160} />
        </View>

        {/* Main Authentication Flow Box */}
        {step === 'pin' ? (
          <View style={styles.authStepContainer}>
            {/* Step Indicator */}
            <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.stepBadgeText, { color: theme.primary }]}>
                {language === 'en' ? 'STEP 1 OF 2: ENTER PIN' : 'ধাপ ১/২: পিন লিখুন'}
              </Text>
            </View>

            {/* PIN Dots */}
            <View style={styles.dotsRow}>
              {dotsArray.map((_, index) => {
                const isActive = index < pin.length;
                return (
                  <View
                    key={index}
                    style={[
                      styles.dotCircle,
                      {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : theme.primary,
                        backgroundColor: isActive ? (isDarkMode ? '#FFFFFF' : theme.primary) : 'transparent',
                      },
                    ]}
                  />
                );
              })}
            </View>

            {isPinVerifying && (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 8 }} />
            )}

            {pinError && <Text style={[styles.errorText, { color: theme.error }]}>{pinError}</Text>}

            {/* Custom Circular Number Pad */}
            <View style={styles.keyboardGrid}>
              {[
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
              ].map((row, rIdx) => (
                <View key={rIdx} style={styles.keyboardRow}>
                  {row.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.circularKey, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                      disabled={isPinVerifying}
                      onPress={() => handleNumPress(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.circularKeyText, { color: theme.text }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              <View style={styles.keyboardRow}>
                <View style={styles.circularKeyBlank} />
                <TouchableOpacity
                  style={[styles.circularKey, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  disabled={isPinVerifying}
                  onPress={() => handleNumPress(0)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.circularKeyText, { color: theme.text }]}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.circularKey, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  disabled={isPinVerifying}
                  onPress={handleBackspace}
                  activeOpacity={0.7}
                >
                  <Ionicons name="backspace-outline" size={26} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* Step 2: Biometric Prompt */
          <View style={styles.authStepContainer}>
            <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.stepBadgeText, { color: theme.primary }]}>
                {language === 'en' ? 'STEP 2 OF 2: BIOMETRIC SCAN' : 'ধাপ ২/২: বায়োমেট্রিক স্ক্যান'}
              </Text>
            </View>

            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginVertical: 20 }}>
              <TouchableOpacity
                onPress={triggerBiometricAuth}
                style={[styles.fingerprintCircle, { backgroundColor: theme.cardBg, borderColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <Ionicons name="finger-print" size={54} color={theme.primary} />
              </TouchableOpacity>
            </Animated.View>

            <Text style={[styles.biometricTitle, { color: theme.text }]}>
              {language === 'en' ? 'Scan Fingerprint' : 'ফিঙ্গারপ্রিন্ট দিন'}
            </Text>
            <Text style={[styles.biometricSubtitle, { color: theme.textSecondary }]}>
              {language === 'en'
                ? 'Touch sensor to complete unlock'
                : 'আনলক সম্পন্ন করতে সেন্সরে আঙুল দিন'}
            </Text>

            {biometricError && <Text style={[styles.errorText, { color: theme.error }]}>{biometricError}</Text>}

            <TouchableOpacity style={[styles.retryBioBtn, { backgroundColor: theme.primary }]} onPress={triggerBiometricAuth}>
              <Text style={styles.retryBioText}>
                {language === 'en' ? 'Tap to Scan' : 'স্ক্যান করতে ট্যাপ করুন'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer Actions */}
        <View style={styles.footerRow}>
          <TouchableOpacity onPress={handleSwitchAccount} activeOpacity={0.7} style={styles.footerBtn}>
            <Text style={[styles.switchAccountText, { color: theme.primary }]}>
              {language === 'en' ? 'Switch Account' : 'অ্যাকাউন্ট পরিবর্তন'}
            </Text>
          </TouchableOpacity>
          <View style={[styles.footerDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={styles.footerBtn}>
            <Text style={[styles.logoutText, { color: theme.error }]}>
              {language === 'en' ? 'Logout' : 'লগআউট'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '96%',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  languageToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  langBtnActive: {},
  langText: {
    fontSize: 12,
    fontWeight: '700',
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  logoSection: {
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSlogan: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: -2,
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  userBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  authStepContainer: {
    alignItems: 'center',
    width: '100%',
    marginVertical: Spacing.md,
  },
  stepBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  dotCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  keyboardGrid: {
    gap: 14,
    width: '100%',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circularKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  circularKeyBlank: {
    width: 72,
    height: 72,
  },
  circularKeyText: {
    fontSize: 26,
    fontWeight: '700',
  },
  fingerprintCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  biometricTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  biometricSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  retryBioBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBioText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    gap: 12,
  },
  footerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  footerDivider: {
    width: 1,
    height: 14,
  },
  switchAccountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
