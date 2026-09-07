import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { LogoMark } from '../components/Logo';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { useAppLock } from '../context/AppLockContext';

const { width } = Dimensions.get('window');
const NUMPAD_WIDTH = width * 0.90;
const KEY_SIZE = NUMPAD_WIDTH / 3;

export default function Login() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { login } = useAuth();
  const { unlock } = useAppLock();

  // Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | null>(null);

  // Screen/Request States
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usernameRef = useRef<TextInput>(null);

  const isFormValid = username.trim() !== '' && password.length === 5 && !isLoading;

  const handleNumPress = (num: number) => {
    if (password.length < 5) {
      setPassword(password + num);
      if (showErrorBanner) {
        setShowErrorBanner(false);
        setErrorMessage(null);
      }
    }
  };

  const handleBackspace = () => {
    if (password.length > 0) {
      setPassword(password.slice(0, -1));
    }
  };

  const handleLogin = async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    setShowErrorBanner(false);
    setErrorMessage(null);

    const result = await login(username, password);

    setIsLoading(false);
    if (result.success) {
      unlock();
      router.replace('/dashboard');
    } else {
      setErrorMessage(result.message || null);
      setShowErrorBanner(true);
      setPassword('');
    }
  };

  const handleForgotK2 = () => {
    Alert.alert(
      t.resetSecurityKeysTitle,
      t.resetSecurityKeysDesc,
      [{ text: t.ok }]
    );
  };

  const maskedPin = '•'.repeat(password.length);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#FFFFFF' }]}>

      {/* Red Warning Banner */}
      {showErrorBanner && (
        <View style={[styles.errorBanner, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF5F5', borderColor: theme.error }]}>
          <View style={styles.errorBannerLeft}>
            <Ionicons name="alert-circle" size={24} color={theme.error} style={styles.errorBannerIcon} />
            <View style={styles.errorBannerTextContainer}>
              <Text style={[styles.errorBannerTitle, { color: theme.error }]}>
                {errorMessage || t.invalidUsernamePassword}
              </Text>
              <Text style={[styles.errorBannerSubtitle, { color: theme.error }]}>
                {errorMessage ? (language === 'en' ? 'Please check your inputs and try again.' : 'অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার চেষ্টা করুন।') : t.checkCredentialsRetry}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowErrorBanner(false)}>
            <Ionicons name="close" size={20} color={theme.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Logo */}
      <View style={styles.logoSection}>
        <LogoMark size={200} />
        <Text style={[styles.brandSlogan, { color: '#999' }]}>Digital Pocket Transaction</Text>
      </View>

      {/* Username Input */}
      <View style={styles.inputSection}>
        <Text style={[styles.label, { color: '#333' }]}>{t.bankUsernameLabel}</Text>
        <Pressable
          onPress={() => usernameRef.current?.focus()}
          style={[
            styles.inputWrapper,
            { borderColor: focusedField === 'username' ? theme.primary : '#E5E5E5' },
          ]}
        >
          <Ionicons
            name="person-outline"
            size={20}
            color={focusedField === 'username' ? theme.primary : '#C0C0C0'}
            style={styles.inputIcon}
          />
          <TextInput
            ref={usernameRef}
            style={[styles.input, { color: '#333' }]}
            placeholder={t.enterRegUsernamePlaceholder}
            placeholderTextColor="#C0C0C0"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              if (showErrorBanner) {
                setShowErrorBanner(false);
                setErrorMessage(null);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            onFocus={() => setFocusedField('username')}
            onBlur={() => setFocusedField(null)}
          />
        </Pressable>
      </View>

      {/* PIN Display */}
      <View style={styles.pinSection}>
        <Text style={[styles.label, { color: '#333' }]}>{t.privatePinLabel}</Text>
        <View style={[styles.pinDisplayRow]}>
          <Text style={[styles.pinReveal, { color: password.length > 0 ? '#333' : '#C0C0C0' }]}>
            {password.length > 0 ? (showPassword ? password : maskedPin) : (language === 'en' ? 'Enter 5-digit PIN' : '৫ ডিজিট পিন দিন')}
          </Text>
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#C0C0C0"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Button */}
      <TouchableOpacity
        style={[
          styles.loginButton,
          { backgroundColor: isFormValid ? theme.primary : '#E5E5E5' },
        ]}
        disabled={!isFormValid}
        onPress={handleLogin}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Text style={[styles.loginButtonText, { color: isFormValid ? '#FFFFFF' : '#999' }]}>
              {t.loginButton}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={isFormValid ? '#FFFFFF' : '#999'} />
          </>
        )}
      </TouchableOpacity>

      {/* Number Pad */}
      <View style={styles.numpad}>
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rIdx) => (
          <View key={rIdx} style={styles.numpadRow}>
            {row.map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.numKey, { width: KEY_SIZE, height: 56 }]}
                disabled={isLoading}
                onPress={() => handleNumPress(num)}
                activeOpacity={0.4}
              >
                <Text style={styles.numKeyText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.numpadRow}>
          <View style={{ width: KEY_SIZE, height: 56 }} />
          <TouchableOpacity
            style={[styles.numKey, { width: KEY_SIZE, height: 56 }]}
            disabled={isLoading}
            onPress={() => handleNumPress(0)}
            activeOpacity={0.4}
          >
            <Text style={styles.numKeyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.numKey, { width: KEY_SIZE, height: 56 }]}
            disabled={isLoading}
            onPress={handleBackspace}
            activeOpacity={0.4}
          >
            <Ionicons name="close" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Links */}
      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => router.push('/officer-verify')} disabled={isLoading}>
          <Text style={[styles.linkText, { color: theme.primary }]}>{t.activateNewAccount}</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: '#E5E5E5' }]} />

        <TouchableOpacity onPress={handleForgotK2} disabled={isLoading}>
          <Text style={[styles.linkText, { color: theme.primary }]}>{t.forgotK2Label}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
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
  // Input
  inputSection: {
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  // PIN Display
  pinSection: {
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  pinDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E5E5',
    paddingBottom: 10,
  },
  eyeBtn: {
    padding: 4,
  },
  pinReveal: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 4,
  },
  // Login Button
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginHorizontal: Spacing.xxl,
    borderRadius: 8,
    gap: 8,
    marginBottom: Spacing.lg,
  },
  loginButtonText: {
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
  // Links
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
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
