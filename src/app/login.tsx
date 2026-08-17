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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { LogoMark } from '../components/Logo';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function Login() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { login } = useAuth();

  // Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // Stores the PIN
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Layout & Focus States
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  // Screen/Request States (Server Auth Errors)
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for touch targets
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Live Format-Validation Error for PIN (Only after touch/blur and if non-empty)
  const passwordFormatError =
    passwordTouched && password.length > 0 && password.length !== 8
      ? t.pinExactlyDigitsError
      : null;

  // Form check: Bank Username filled + PIN is exactly 8 digits
  const isFormValid = username.trim() !== '' && password.length === 8 && !isLoading;

  const handleLogin = async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    setShowErrorBanner(false);
    setErrorMessage(null);

    const result = await login(username, password);

    setIsLoading(false);
    if (result.success) {
      router.replace('/dashboard');
    } else {
      setErrorMessage(result.message || null);
      setShowErrorBanner(true);
    }
  };

  const handleForgotK2 = () => {
    Alert.alert(
      t.resetSecurityKeysTitle,
      t.resetSecurityKeysDesc,
      [{ text: t.ok }]
    );
  };

  const handleTextInputChange = (field: 'username' | 'password', text: string) => {
    if (field === 'username') {
      setUsername(text);
    }
    if (field === 'password') {
      const digits = text.replace(/[^0-9]/g, '');
      setPassword(digits);
    }

    // Clear server error banner on input edit
    if (showErrorBanner) {
      setShowErrorBanner(false);
      setErrorMessage(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header showBackButton={true} />

      {/* Red Warning Banner (Server ERROR STATE only) */}
      {showErrorBanner && (
        <View style={[styles.errorBanner, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF5F5', borderColor: theme.error }]}>
          <View style={styles.errorBannerLeft}>
            <Ionicons name="alert-circle" size={24} color={theme.error} style={styles.errorBannerIcon} />
            <View style={styles.errorBannerTextContainer}>
              <Text style={[styles.errorBannerTitle, { color: theme.error }]}>
                {errorMessage || t.invalidUsernamePassword}
              </Text>
              <Text style={[styles.errorBannerSubtitle, { color: theme.error }]}>
                {errorMessage ? (language === 'en' ? 'Please check your inputs and try again.' : 'অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার চেষ্টা করুন।') : t.checkCredentialsRetry}
              </Text>
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
          {/* Top Big Centered Logo & Punchline */}
          <View style={styles.logoContainer}>
            <LogoMark size={200} />
          </View>
          <Text style={[styles.brandSlogan, { color: theme.textSecondary }]}>
            Digital Pocket Transaction
          </Text>

          {/* Prompt Header */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{t.welcomeBack}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.loginToAccount}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            
            {/* Field 1: Bank Username */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.bankUsernameLabel}</Text>
              <Pressable
                onPress={() => usernameRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'username' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  showErrorBanner && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={
                    showErrorBanner
                      ? theme.error
                      : focusedField === 'username'
                      ? theme.primary
                      : theme.textSecondary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={usernameRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.enterRegUsernamePlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={username}
                  onChangeText={(text) => handleTextInputChange('username', text)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </Pressable>
            </View>

            {/* Field 2: Private PIN */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.privatePinLabel}</Text>
              <Pressable
                onPress={() => passwordRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'password' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  (passwordFormatError || showErrorBanner) && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color={
                    (passwordFormatError || showErrorBanner)
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
                  placeholder={t.enterPinPlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={password}
                  onChangeText={(text) => handleTextInputChange('password', text)}
                  keyboardType="number-pad"
                  maxLength={8}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => {
                    setFocusedField(null);
                    if (password.length > 0) {
                      setPasswordTouched(true);
                    }
                  }}
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
              {passwordFormatError && (
                <Text style={[styles.errorText, { color: theme.error }]}>{passwordFormatError}</Text>
              )}
            </View>

          </View>
        </ScrollView>

        {/* Sticky Login Action Button & Sub-links at the bottom */}
        <View style={[styles.footerContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.loginButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              !isFormValid && [styles.loginButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
            ]}
            disabled={!isFormValid}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.loginButtonText}>{t.loggingIn}</Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>{t.loginButton}</Text>
            )}
          </TouchableOpacity>

          {/* Sub-links */}
          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => router.push('/officer-verify')} disabled={isLoading}>
              <Text style={[styles.linkText, { color: theme.primary }]}>{t.activateNewAccount}</Text>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <TouchableOpacity onPress={handleForgotK2} disabled={isLoading}>
              <Text style={[styles.linkText, { color: theme.primary }]}>{t.forgotK2Label}</Text>
            </TouchableOpacity>
          </View>
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
    marginTop: Spacing.xs,
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
  // Logo Container
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.sm,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoTextAccent: {},
  brandSlogan: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  // Illustration
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xs,
  },
  illustration: {
    width: width * 0.75,
    height: width * 0.5,
  },
  // Header texts
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
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
  inputWrapperError: {},
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
  // Footer / Buttons container
  footerContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.lg,
  },
  loginButton: {
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  loginButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 16,
    marginHorizontal: Spacing.lg,
  },
});
