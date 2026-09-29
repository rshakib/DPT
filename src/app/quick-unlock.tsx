import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { useAppLock } from '../context/AppLockContext';
import { verifyPinLocally, getPinLockoutStatus, verifyDuressPin } from '../utils/security';
import { LogoMark } from '../components/Logo';

const { width } = Dimensions.get('window');
const NUMPAD_WIDTH = width * 0.90;
const KEY_SIZE = NUMPAD_WIDTH / 3;
const KEY_GAP = 0;

type UnlockStep = 'pin' | 'biometric' | 'unlocked';

export default function QuickUnlock() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];

  const { user, lastLoggedInUser, logout, switchAccount, setDuressMode, initDuressBalance } = useAuth();
  const { unlock } = useAppLock();

  const [step, setStep] = useState<UnlockStep>('pin');
  const [pin, setPin] = useState('');
  const [isPinVerifying, setIsPinVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [shakeAnim] = useState(new Animated.Value(0));

  const [hasBiometricHardware, setHasBiometricHardware] = useState(true);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(true);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    checkBiometricsSupport();
    const username = user?.username || lastLoggedInUser || '';
    if (username) {
      getPinLockoutStatus(username).then((status) => {
        if (status.isLocked && isMounted.current) {
          setPinError(status.message || 'PIN locked for 15 minutes.');
        }
      });
    }
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (step === 'biometric') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => { if (animation) animation.stop(); };
  }, [pulseAnim, step]);

  const checkBiometricsSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      setHasBiometricHardware(hasHardware);
      if (!hasHardware) return;
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricEnrolled(isEnrolled);
    } catch {
      setHasBiometricHardware(false);
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleNumPress = async (num: number) => {
    if (step !== 'pin' || isPinVerifying) return;
    if (pin.length < 5) {
      const nextPin = pin + num;
      setPin(nextPin);
      setPinError(null);

      if (nextPin.length === 5) {
        setIsPinVerifying(true);
        const username = user?.username || lastLoggedInUser || '';

        // Duress check first (paper §3.1): a matching duress PIN selects the duress
        // key and never touches the server. The attacker sees a normal unlock.
        const isDuress = await verifyDuressPin(username, nextPin);
        if (isDuress) {
          if (!isMounted.current) return;
          setIsPinVerifying(false);
          setDuressMode(true);
          initDuressBalance(user?.balance);
          if (hasBiometricHardware && isBiometricEnrolled) {
            setStep('biometric');
            triggerBiometricAuth();
          } else {
            unlock();
          }
          return;
        }

        const result = await verifyPinLocally(username, nextPin);

        if (!isMounted.current) return;
        setIsPinVerifying(false);

        if (result.success) {
          setDuressMode(false);
          if (hasBiometricHardware && isBiometricEnrolled) {
            setStep('biometric');
            triggerBiometricAuth();
          } else {
            unlock();
          }
        } else {
          setPinError(result.message || (language === 'en' ? 'Incorrect PIN' : 'ভুল পিন'));
          triggerShake();
          setTimeout(() => { if (isMounted.current) setPin(''); }, 300);
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

  const triggerBiometricAuth = async () => {
    if (!hasBiometricHardware || !isBiometricEnrolled) { unlock(); return; }
    try {
      if (!isMounted.current) return;
      setBiometricError(null);
      setIsBiometricAuthenticating(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.verifyBiometricIdentityMsg || (language === 'en' ? 'Scan fingerprint to unlock' : 'আনলক করতে ফিঙ্গারপ্রিন্ট দিন'),
        fallbackLabel: t.usePinInsteadMsg || 'Cancel',
        disableDeviceFallback: false,
      });

      if (!isMounted.current) return;
      setIsBiometricAuthenticating(false);

      if (result.success) {
        setStep('unlocked');
        setTimeout(() => {
          if (isMounted.current) unlock();
        }, 300);
      } else {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          setBiometricError(result.error || (language === 'en' ? 'Biometric failed' : 'বায়োমেট্রিক ব্যর্থ'));
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        setIsBiometricAuthenticating(false);
        setBiometricError(err.message || 'Error');
      }
    }
  };

  const handleSwitchAccount = async () => {
    await switchAccount();
    unlock();
    router.replace('/login');
  };

  const handleLogout = async () => {
    await logout();
    unlock();
    router.replace('/login');
  };

  const maskedPin = '•'.repeat(pin.length);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#FFFFFF' }]}>
      <StatusBar barStyle="dark-content" />

      {/* Top Bar — Language toggle only */}
      <View style={styles.topBar}>
        <View style={styles.langToggle}>
          <TouchableOpacity
            onPress={() => toggleLanguage('en')}
            style={[styles.langBtn, language === 'en' && { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.langText, language === 'en' && { color: '#FFFFFF' }]}>Eng</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleLanguage('bn')}
            style={[styles.langBtn, language === 'bn' && { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.langText, language === 'bn' && { color: '#FFFFFF' }]}>বাং</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logo — same style as login page */}
      <View style={styles.logoSection}>
        <LogoMark size={200} />
        <Text style={[styles.brandSlogan, { color: '#999' }]}>Digital Pocket Transaction</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: '#333' }]}>
        {step === 'pin'
          ? (language === 'en' ? 'Enter your DPT PIN' : 'আপনার DPT পিন দিন')
          : (language === 'en' ? 'Verify your identity' : 'আপনার পরিচয় যাচাই করুন')}
      </Text>

      {step === 'pin' ? (
        <>
          {/* PIN Input Display */}
          <View style={styles.pinInputContainer}>
            <View style={[styles.pinInputField, { borderColor: pinError ? '#FF3B30' : '#E5E5E5' }]}>
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <Text style={[styles.pinDisplay, { color: pin.length > 0 ? '#333' : '#C0C0C0' }]}>
                  {pin.length > 0 ? maskedPin : (language === 'en' ? 'Enter PIN' : 'পিন দিন')}
                </Text>
              </Animated.View>
            </View>

            {/* Error text */}
            {pinError && (
              <Text style={[styles.errorText, { color: '#FF3B30' }]}>{pinError}</Text>
            )}

            {/* Loading */}
            {isPinVerifying && (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 8 }} />
            )}
          </View>

          {/* Next Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: pin.length === 5 ? theme.primary : '#E5E5E5' },
            ]}
            disabled={pin.length < 5 || isPinVerifying}
            activeOpacity={0.8}
          >
            <Text style={[styles.nextButtonText, { color: pin.length === 5 ? '#FFFFFF' : '#999' }]}>
              {t.next || 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={pin.length === 5 ? '#FFFFFF' : '#999'} />
          </TouchableOpacity>

          {/* Number Pad */}
          <View style={styles.numpad}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rIdx) => (
              <View key={rIdx} style={styles.numpadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.numKey, { width: KEY_SIZE, height: 56 }]}
                    disabled={isPinVerifying}
                    onPress={() => handleNumPress(num)}
                    activeOpacity={0.4}
                  >
                    <Text style={styles.numKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.numpadRow}>
              {/* Empty space (biometric is automatic after PIN, no shortcut) */}
              <View style={{ width: KEY_SIZE, height: 56 }} />
              <TouchableOpacity
                style={[styles.numKey, { width: KEY_SIZE, height: 56 }]}
                disabled={isPinVerifying}
                onPress={() => handleNumPress(0)}
                activeOpacity={0.4}
              >
                <Text style={styles.numKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.numKey, { width: KEY_SIZE, height: 56 }]}
                disabled={isPinVerifying}
                onPress={handleBackspace}
                activeOpacity={0.4}
              >
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={[styles.footerText, { color: '#999' }]}>
                {language === 'en' ? 'Logout' : 'লগআউট'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* Biometric Step */
        <View style={styles.biometricSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              onPress={triggerBiometricAuth}
              style={[styles.fingerprintCircle, { borderColor: theme.primary }]}
              activeOpacity={0.8}
            >
              <Ionicons name="finger-print" size={56} color={theme.primary} />
            </TouchableOpacity>
          </Animated.View>

          <Text style={[styles.bioTitle, { color: '#333' }]}>
            {language === 'en' ? 'Scan Fingerprint' : 'ফিঙ্গারপ্রিন্ট দিন'}
          </Text>
          <Text style={[styles.bioSubtitle, { color: '#999' }]}>
            {language === 'en' ? 'Touch sensor to unlock' : 'আনলক করতে সেন্সরে আঙুল দিন'}
          </Text>

          {biometricError && (
            <Text style={[styles.errorText, { color: '#FF3B30' }]}>{biometricError}</Text>
          )}

          {isBiometricAuthenticating && (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
          )}

          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={triggerBiometricAuth}
          >
            <Text style={styles.retryBtnText}>
              {language === 'en' ? 'Tap to Scan' : 'স্ক্যান করুন'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToPinBtn}
            onPress={() => { setStep('pin'); setBiometricError(null); }}
          >
            <Text style={[styles.backToPinText, { color: theme.primary }]}>
              {language === 'en' ? 'Use PIN instead' : 'পিন দিয়ে যান'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  langText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  // Logo
  logoSection: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  brandSlogan: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  // Title
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  // PIN Input
  pinInputContainer: {
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  pinInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  pinDisplay: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 4,
  },
  // Next Button
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginHorizontal: Spacing.xxl,
    borderRadius: 8,
    gap: 8,
    marginBottom: Spacing.lg,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Numpad
  numpad: {
    alignItems: 'center',
    width: '100%',
  },
  numpadRow: {
    flexDirection: 'row',
  },
  numKey: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyText: {
    fontSize: 32,
    fontWeight: '500',
    color: '#333',
  },
  // Biometric
  biometricSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  fingerprintCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  bioTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  bioSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  backToPinBtn: {
    marginTop: Spacing.xl,
    paddingVertical: 8,
  },
  backToPinText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
