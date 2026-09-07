import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { Image } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { useAppLock } from '../context/AppLockContext';
import * as api from '../services/api';
import { saveLocalPinHash } from '../utils/security';
import { generateRSAKeyPair } from '../services/crypto';

const { width } = Dimensions.get('window');

export default function CreatePassword() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { login } = useAuth();
  const { unlock } = useAppLock();
  
  // Retrieve navigation parameters from previous screens
  const params = useLocalSearchParams();
  const rawNid = Array.isArray(params.nid) ? params.nid[0] : params.nid;
  const rawCode = Array.isArray(params.activationCode) ? params.activationCode[0] : params.activationCode;
  const rawUser = Array.isArray(params.username) ? params.username[0] : params.username;

  const nid = String(rawNid || '').trim();
  const activationCode = String(rawCode || '').trim();
  const username = String(rawUser || '').toLowerCase().trim();
  const rawFullName = Array.isArray(params.fullName) ? params.fullName[0] : params.fullName;
  const fullName = String(rawFullName || '').trim();

  // Form States (PIN values)
  const [password, setPassword] = useState(''); // Stores the PIN
  const [confirmPassword, setConfirmPassword] = useState(''); // Stores the confirmed PIN
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Focus & Layout States
  const [focusedField, setFocusedField] = useState<'password' | 'confirmPassword' | null>(null);

  // Mutual Exclusive Screen States (API errors)
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  // Input Refs for touch forwarding
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Live validation checks — exact 5 digits
  const isExactLength = password.length === 5;

  // Live field-level errors calculated dynamically on render
  const passwordError = fieldErrors.password ? t.pinLengthLimitError : null;

  const confirmPasswordError =
    confirmPassword.length > 0 && password !== confirmPassword
      ? t.pinMismatchError
      : fieldErrors.confirmPassword
      ? t.pinMismatchError
      : null;

  // Filter input to only numeric digits
  const handlePasswordChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setPassword(digits);
    if (showErrorBanner || fieldErrors.password || fieldErrors.confirmPassword) {
      setShowErrorBanner(false);
      setFieldErrors({});
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setConfirmPassword(digits);
    if (showErrorBanner || fieldErrors.password || fieldErrors.confirmPassword) {
      setShowErrorBanner(false);
      setFieldErrors({});
    }
  };

  // Form submission validation — exact 5 digits
  const isFormValid =
    isExactLength &&
    confirmPassword.length === 5 &&
    password === confirmPassword &&
    !isLoading;

  const handleActivate = async () => {
    if (!isFormValid) return;

    // Reset previous states
    setIsLoading(true);
    setShowErrorBanner(false);
    setErrorMessage('');
    setFieldErrors({});

    try {
      if (!username || !nid || !activationCode || password.length !== 5) {
        setIsLoading(false);
        setShowErrorBanner(true);
        setErrorMessage('Missing username, password, NID/BRC, or activation code');
        return;
      }

      // Register first (RSA key generation happens in background after)
      const result = await api.register(
        username,
        password,
        nid,
        activationCode,
        {
          fullName: fullName || undefined,
          biometricEnrolled: true,
        }
      );

      if (result.success) {
        await saveLocalPinHash(username, password);

        // Auto-authenticate session
        const loginRes = await login(username, password);
        if (loginRes.success) {
          unlock();
        }

        setIsLoading(false);

        // Navigate to success page immediately
        router.push({
          pathname: '/activation-success',
          params: {
            nid,
            activationCode,
            username,
            password,
          },
        });

        // Generate RSA keys in background (non-blocking)
        setTimeout(() => {
          generateRSAKeyPair().then((keyResult) => {
            if (keyResult.success && keyResult.publicKeyPem) {
              console.log('[CREATE-PASSWORD] RSA key generated, uploading to server...');
              api.register(username, password, nid, activationCode, {
                rsaPublicKey: keyResult.publicKeyPem,
              }).catch(() => {});
            }
          }).catch((e: any) => {
            console.warn('[CREATE-PASSWORD] Background RSA generation skipped:', e);
          });
        }, 2000);

      } else {
        setIsLoading(false);
        setShowErrorBanner(true);
        setErrorMessage(result.message || 'Registration failed.');
      }
    } catch (e: any) {
      setIsLoading(false);
      setShowErrorBanner(true);
      setErrorMessage(e.message || 'Connection error occurred.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.createPinTitle} />

      {/* Red Warning Banner (ERROR STATE only) */}
      {showErrorBanner && (
        <View style={[styles.errorBanner, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF5F5', borderColor: theme.error }]}>
          <View style={styles.errorBannerLeft}>
            <Ionicons name="alert-circle" size={24} color={theme.error} style={styles.errorBannerIcon} />
            <View style={styles.errorBannerTextContainer}>
              <Text style={[styles.errorBannerTitle, { color: theme.error }]}>{t.pinRequirementsError}</Text>
              <Text style={[styles.errorBannerSubtitle, { color: theme.error }]}>{errorMessage || t.ensurePinCriteria}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowErrorBanner(false)}>
            <Ionicons name="close" size={20} color={theme.error} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require('../../assets/images/lock_shield_illustration.jpg')}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>

          {/* Prompt Subtitle */}
          <View style={styles.textContainer}>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t.createPinSubtitle}
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            
            {/* Field 1: Create PIN */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.createPinLabel}</Text>
              <Pressable
                onPress={() => passwordRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'password' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  passwordError ? [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }] : null,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color={
                    passwordError
                      ? theme.error
                      : focusedField === 'password'
                      ? theme.primary
                      : theme.textSecondary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.pinMinLengthPlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={password}
                  onChangeText={handlePasswordChange}
                  keyboardType="number-pad"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#A5A3C1"
                  />
                </TouchableOpacity>
              </Pressable>
              {passwordError && <Text style={[styles.errorText, { color: theme.error }]}>{passwordError}</Text>}
            </View>

            {/* Field 2: Confirm PIN */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.confirmPinLabel}</Text>
              <Pressable
                onPress={() => confirmPasswordRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'confirmPassword' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  confirmPasswordError ? [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }] : null,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color={
                    confirmPasswordError
                      ? theme.error
                      : focusedField === 'confirmPassword'
                      ? theme.primary
                      : theme.textSecondary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={confirmPasswordRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.pinConfirmPlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  keyboardType="number-pad"
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#A5A3C1"
                  />
                </TouchableOpacity>
              </Pressable>
              {confirmPasswordError && (
                <Text style={[styles.errorText, { color: theme.error }]}>{confirmPasswordError}</Text>
              )}
            </View>

            {/* Live PIN Strength Checklist */}
            <View style={[styles.checklistCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.checkItem}>
                <Ionicons
                  name={isExactLength ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isExactLength ? theme.primary : (isDarkMode ? '#555' : '#D1CCEC')}
                />
                <Text style={[styles.checkText, { color: theme.textSecondary }, isExactLength && [styles.checkTextActive, { color: theme.primary }]]}>
                  {t.pinMinLengthPlaceholder}
                </Text>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* Sticky Action Button at the bottom */}
        <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.activateButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              !isFormValid && [styles.activateButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
            ]}
            disabled={!isFormValid}
            onPress={handleActivate}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.activateButtonText}>{t.loggingIn}</Text>
              </View>
            ) : (
              <Text style={styles.activateButtonText}>{t.activateContinue}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },
  // Error Banner styling
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.sm,
  },
  errorBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  errorBannerIcon: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  errorBannerTextContainer: {
    flex: 1,
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Illustration
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  illustration: {
    width: width * 0.42,
    height: width * 0.42,
  },
  // Header texts
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  // Form layout
  formContainer: {
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  inputWrapper: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  inputWrapperError: {
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: Spacing.xs,
    marginTop: Spacing.xs,
  },
  // Live validation checklist style
  checklistCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    alignItems: 'center',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  checkTextActive: {
    fontWeight: '700',
  },
  // Sticky bottom action
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
  },
  activateButton: {
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  activateButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
