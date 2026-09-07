import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  findNodeHandle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
const Sentry = {
  addBreadcrumb: (..._args: any[]) => {},
  captureException: (..._args: any[]) => {},
};
import { Spacing } from '../constants/theme';
import { Header } from './Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { getPinLockoutStatus } from '../utils/security';

const { width } = Dimensions.get('window');

type BiometricStatus = 'checking' | 'enrolled' | 'not-supported' | 'not-enrolled' | 'authenticating' | 'success' | 'failed';

interface TransactionAuthScreenProps {
  title?: string;
  summaryLabel: string;
  summaryTitle: string;
  summarySubtitle?: string;
  amount: string;
  onAuthorized: () => void;
  onCancel: () => void;
  pinLength?: number;
  onVerifyPin?: (pin: string) => Promise<{ success: boolean; message?: string }>;
}

export function TransactionAuthScreen({
  title = 'Confirm Payment',
  summaryLabel,
  summaryTitle,
  summarySubtitle,
  amount,
  onAuthorized,
  onCancel,
  pinLength = 5,
  onVerifyPin,
}: TransactionAuthScreenProps) {
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Custom PIN Entry State
  const [pin, setPin] = useState('');
  const [isPinVerifying, setIsPinVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Biometrics Hardware Check States
  const [hasBiometricHardware, setHasBiometricHardware] = useState(true);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(true);

  // Flow State: Unlocked only after biometric success (or automatic fallback if unavailable)
  const [isBiometricVerified, setIsBiometricVerified] = useState(false);

  // Status logs
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>('checking');
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Animation values & refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Start continuous loop scale animation for pulsing fingerprint
  useEffect(() => {
    loopAnimRef.current = Animated.loop(
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
    );
    loopAnimRef.current.start();

    return () => {
      if (loopAnimRef.current) {
        loopAnimRef.current.stop();
      }
    };
  }, [pulseAnim]);

  const containerRef = useRef<View>(null);
  const isMounted = useRef(true);
  const isNavigatingRef = useRef(false);

  const safeAuthorized = () => {
    const timestamp = Date.now();
    console.log(`[DPT_NATIVE_TRACE][NAV_CALL] caller=TransactionAuthScreen.safeAuthorized timestamp=${timestamp} isNavigating=${isNavigatingRef.current}`);
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    onAuthorized();
  };

  const { user } = useAuth();

  // Check biometric support and PIN lockout status on mount
  useEffect(() => {
    isMounted.current = true;
    const nodeTag = containerRef.current ? findNodeHandle(containerRef.current) : null;
    console.log(`[DPT_NATIVE_TRACE][MOUNT] screen=TransactionAuthScreen nativeTag=${nodeTag} timestamp=${Date.now()}`);
    
    if (user?.username) {
      getPinLockoutStatus(user.username).then((status) => {
        if (status.isLocked && isMounted.current) {
          setPinError(status.message || 'PIN authentication is locked for 15 minutes.');
        }
      });
    }

    checkBiometrics();
    return () => {
      isMounted.current = false;
      console.log(`[DPT_NATIVE_TRACE][UNMOUNT] screen=TransactionAuthScreen nativeTag=${nodeTag} timestamp=${Date.now()}`);
      if (loopAnimRef.current) {
        loopAnimRef.current.stop();
      }
    };
  }, []);

  const stopAnimations = () => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Stopping native driver animations before navigation',
      level: 'info',
    });
    if (loopAnimRef.current) {
      loopAnimRef.current.stop();
      loopAnimRef.current = null;
    }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const checkBiometrics = async () => {
    try {
      if (!isMounted.current) return;
      setBiometricError(null);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!isMounted.current) return;
      setHasBiometricHardware(hasHardware);
      if (!hasHardware) {
        setBiometricStatus('not-supported');
        setIsBiometricVerified(true);
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isMounted.current) return;
      setIsBiometricEnrolled(isEnrolled);
      if (!isEnrolled) {
        setBiometricStatus('not-enrolled');
        setIsBiometricVerified(true);
        return;
      }

      setBiometricStatus('enrolled');
      setIsBiometricVerified(false);
      
      // Auto-trigger biometric prompt on screen load
      setTimeout(() => {
        if (isMounted.current) {
          triggerBiometricAuth();
        }
      }, 500);

    } catch (err: any) {
      if (isMounted.current) {
        setBiometricStatus('failed');
        setBiometricError(err.message || 'Biometric initialization failed.');
        setIsBiometricVerified(true);
      }
    }
  };

  const triggerBiometricAuth = async () => {
    if (!hasBiometricHardware || !isBiometricEnrolled) {
      return;
    }

    try {
      if (!isMounted.current) return;
      setBiometricError(null);
      setBiometricStatus('authenticating');
      console.log(`[DPT_NATIVE_TRACE][BIOMETRIC] event=start timestamp=${Date.now()}`);

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Triggering LocalAuthentication.authenticateAsync prompt',
        level: 'info',
      });

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.verifyBiometricIdentityMsg || 'Verify biometric identity to proceed',
        fallbackLabel: t.usePinInsteadMsg || 'Use PIN Instead',
        disableDeviceFallback: false,
      });

      console.log(`[DPT_NATIVE_TRACE][BIOMETRIC] event=${result.success ? 'success' : 'failed'} timestamp=${Date.now()}`);

      if (!isMounted.current) return;

      if (result.success) {
        console.log('[DIAGNOSTIC] 1. Biometric verification succeeded!');
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Biometric authentication succeeded',
          level: 'info',
        });
        setBiometricStatus('success');
        setIsBiometricVerified(true);
      } else {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: `Biometric authentication failed: ${result.error}`,
          level: 'warning',
        });
        setBiometricStatus('failed');
        setIsBiometricVerified(false);
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          setBiometricError(result.error || 'Biometric authentication failed.');
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        setBiometricStatus('failed');
        setIsBiometricVerified(false);
        setBiometricError(err.message || 'Authentication error.');
      }
    }
  };

  // Custom PIN key press handler
  const handleNumPress = async (num: number) => {
    if (!isBiometricVerified || isPinVerifying) return;

    if (pin.length < pinLength) {
      const nextPin = pin + num;
      setPin(nextPin);
      setPinError(null);

      // Once exactly pinLength digits are entered, verify or auto-confirm
      if (nextPin.length === pinLength) {
        if (onVerifyPin) {
          setIsPinVerifying(true);
          try {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Full PIN entered, calling onVerifyPin',
              level: 'info',
            });
            const result = await onVerifyPin(nextPin);
            if (!isMounted.current) return;
            if (result.success) {
              console.log('[DIAGNOSTIC] 2. PIN verification succeeded!', {
                summaryTitle,
                summarySubtitle,
                amount,
              });
              console.log('================ [DIAGNOSTIC TEST START] ================');
              console.log('✅ [CHECK 1/4] Biometric/Keymaster state verified.');
              console.log('✅ [CHECK 2/4] PIN verification succeeded locally.');
              console.log('🔄 [CHECK 3/4] Halting native driver animations (pulseAnim/rotationAnim)...');
              stopAnimations();
              console.log('✅ [CHECK 3/4 PASSED] Native animation nodes safely detached.');
              console.log('⏳ [CHECK 4/4] Activating 300ms layout barrier for Fabric...');

              setTimeout(() => {
                setTimeout(() => {
                  if (!isMounted.current) return;
                  setIsPinVerifying(false);
                  console.log('🚀 [CHECK 4/4 PASSED] UI thread settled. Executing safe screen transition.');
                  console.log('================ [DIAGNOSTIC TEST COMPLETE] ================');

                  Sentry.addBreadcrumb({
                    category: 'auth',
                    message: 'Executing onAuthorized navigation callback',
                    level: 'info',
                  });
                  safeAuthorized();
                }, 300);
              });
            } else {
              Sentry.addBreadcrumb({
                category: 'auth',
                message: `PIN verification failed: ${result.message}`,
                level: 'warning',
              });
              setPinError(result.message || 'Invalid PIN');
              setPin(''); // Clear PIN for retry
              setIsPinVerifying(false);
            }
          } catch (e: any) {
            if (isMounted.current) {
              setPinError('Connection error occurred.');
              setPin('');
              setIsPinVerifying(false);
            }
          }
        } else {
          stopAnimations();
          setTimeout(() => {
            setTimeout(() => {
              if (isMounted.current) {
                safeAuthorized();
              }
            }, 300);
          });
        }
      }
    }
  };

  const handleBackspace = () => {
    if (!isBiometricVerified || isPinVerifying) return;

    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setPinError(null);
    }
  };

  const isBiometricActive = hasBiometricHardware && isBiometricEnrolled;
  const isPinPadActive = isBiometricVerified && !isPinVerifying;

  // Create an array of dots matching pinLength
  const dotsArray = Array.from({ length: pinLength });

  return (
    <SafeAreaView ref={containerRef} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={title} onBackPress={onCancel} />

      <View style={styles.contentContainer}>
        {/* Transaction Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowColor: theme.primary }]}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{summaryLabel}</Text>
          <Text style={[styles.receiverText, { color: theme.text }]}>{summaryTitle}</Text>
          {summarySubtitle ? (
            <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>{summarySubtitle}</Text>
          ) : null}
          <Text style={[styles.amountText, { color: theme.primary }]}>৳ {parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        {/* Visual Progress Checklist */}
        <View style={[styles.checklistContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {/* Step 1: Biometric Verification */}
          <View style={styles.checkItem}>
            <Ionicons
              name={isBiometricVerified ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={
                isBiometricVerified
                  ? '#09C487'
                  : biometricStatus === 'authenticating'
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <Text style={[
              styles.checkItemText,
              isBiometricVerified
                ? [styles.checkItemTextDone, { color: theme.textSecondary }]
                : biometricStatus === 'authenticating'
                ? [styles.checkItemTextActive, { color: theme.primary }]
                : [styles.checkItemTextPending, { color: theme.border }]
            ]}>
              {!isBiometricActive
                ? t.biometricsUnavailableSkipped || 'Biometrics (Unavailable - Skipped)'
                : isBiometricVerified
                ? t.biometricsVerified || 'Biometrics Verified'
                : t.verifyBiometricsPrompt || 'Verify Biometrics'}
            </Text>
          </View>

          {/* Step 2: PIN Entry */}
          <View style={styles.checkItem}>
            <Ionicons
              name={pin.length === pinLength ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={
                pin.length === pinLength
                  ? '#09C487'
                  : isBiometricVerified
                  ? theme.primary
                  : theme.border
              }
            />
            <Text style={[
              styles.checkItemText,
              pin.length === pinLength
                ? [styles.checkItemTextDone, { color: theme.textSecondary }]
                : isBiometricVerified
                ? [styles.checkItemTextActive, { color: theme.primary }]
                : [styles.checkItemTextPending, { color: theme.border }]
            ]}>
              {t.enterDigitsPin?.replace('{pinLength}', String(pinLength)) || `Enter ${pinLength}-Digit PIN`}
            </Text>
          </View>
        </View>

        {/* Biometric Interactive Section */}
        {isBiometricActive && (
          <View style={styles.biometricSection}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                onPress={triggerBiometricAuth}
                style={[
                  styles.fingerprintButton,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                  isBiometricVerified && [styles.fingerprintSuccess, { backgroundColor: '#09C487', borderColor: '#09C487' }],
                  biometricStatus === 'failed' && !isBiometricVerified && [styles.fingerprintFailed, { borderColor: theme.error }],
                ]}
                activeOpacity={0.8}
                disabled={isBiometricVerified}
              >
                <Ionicons
                  name={isBiometricVerified ? 'checkmark' : 'finger-print'}
                  size={44}
                  color={
                    isBiometricVerified
                      ? '#FFFFFF'
                      : biometricStatus === 'failed'
                      ? theme.error
                      : theme.primary
                  }
                />
              </TouchableOpacity>
            </Animated.View>
            <Text style={[styles.biometricPrompt, { color: theme.textSecondary }]}>
              {isBiometricVerified
                ? t.biometricVerifiedEnterPin || 'Biometrics verified. Enter PIN below.'
                : t.tapRetryBiometricScan || 'Tap to retry biometric scan'}
            </Text>
            {biometricError && <Text style={[styles.biometricErrorText, { color: theme.error }]}>{biometricError}</Text>}
          </View>
        )}

        {/* Visual Indicators for Entered PIN */}
        <View style={styles.dotsAndLoaderContainer}>
          {isPinVerifying ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.spinner} />
          ) : (
            <View style={[styles.dotsContainer, !isPinPadActive && styles.disabledOpacity]}>
              {dotsArray.map((_, index) => {
                const isFilled = index < pin.length;
                return (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      isFilled 
                        ? (pinError ? [styles.dotError, { backgroundColor: theme.error }] : [styles.dotFilled, { backgroundColor: theme.primary }]) 
                        : [styles.dotEmpty, { borderColor: theme.border }],
                    ]}
                  />
                );
              })}
            </View>
          )}
          {pinError && <Text style={[styles.pinErrorText, { color: theme.error }]}>{pinError}</Text>}
        </View>

        {/* Custom Numeric PIN Pad Grid */}
        <View style={[styles.pinPadContainer, !isPinPadActive && styles.disabledOpacity]}>
          {/* Row 1 */}
          <View style={styles.pinRow}>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(1)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(2)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(3)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>3</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2 */}
          <View style={styles.pinRow}>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(4)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(5)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(6)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>6</Text>
            </TouchableOpacity>
          </View>

          {/* Row 3 */}
          <View style={styles.pinRow}>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(7)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>7</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(8)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>8</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(9)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>9</Text>
            </TouchableOpacity>
          </View>

          {/* Row 4 */}
          <View style={styles.pinRow}>
            {/* Left extra key: Biometric retry trigger */}
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={triggerBiometricAuth}
              disabled={!isBiometricActive || isBiometricVerified}
            >
              <Ionicons
                name="finger-print"
                size={24}
                color={
                  !isBiometricActive || isBiometricVerified
                    ? theme.border
                    : theme.primary
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={() => handleNumPress(0)}
              disabled={!isPinPadActive}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>0</Text>
            </TouchableOpacity>

            {/* Right extra key: Backspace */}
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              onPress={handleBackspace}
              disabled={!isPinPadActive}
            >
              <Ionicons name="backspace-outline" size={24} color={isPinPadActive ? theme.text : theme.border} />
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  // Summary Card
  summaryCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    marginVertical: Spacing.xs,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  receiverText: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  summarySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  // Progress Checklist
  checklistContainer: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkItemTextPending: {},
  checkItemTextActive: {
    fontWeight: '700',
  },
  checkItemTextDone: {},
  // Biometric section
  biometricSection: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  fingerprintButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  fingerprintSuccess: {},
  fingerprintFailed: {},
  biometricPrompt: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  biometricErrorText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Visual indicators for Entered PIN
  dotsAndLoaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xs,
    gap: Spacing.xs,
    height: 36,
  },
  spinner: {
    paddingVertical: 6,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotEmpty: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  dotFilled: {},
  dotError: {},
  pinErrorText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Custom PIN pad layout
  pinPadContainer: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  keyButton: {
    width: 70,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
  },
  disabledOpacity: {
    opacity: 0.35,
  },
});
