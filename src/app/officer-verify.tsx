import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

const { width } = Dimensions.get('window');

export default function OfficerVerify() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Form states
  const [nid, setNid] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [username, setUsername] = useState('');

  // Track focused field for premium active styling
  const [focusedField, setFocusedField] = useState<'nid' | 'code' | 'username' | null>(null);

  // Refs for focusing inputs programmatically
  const nidInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);

  // Filter input to only numeric digits
  const handleNidChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length <= 17) {
      setNid(digits);
    }
  };

  const handleCodeChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length <= 6) {
      setActivationCode(digits);
    }
  };

  // Format validations using localizations
  const nidError = nid.length > 0 && nid.length !== 10 && nid.length !== 17
    ? t.nidLengthError
    : null;

  const codeError = activationCode.length > 0 && activationCode.length !== 6
    ? t.activationCodeLengthError
    : null;

  // Validate form: all fields filled + pass their formatting checks
  const isFormValid =
    (nid.length === 10 || nid.length === 17) &&
    activationCode.length === 6 &&
    username.trim() !== '';

  const handleContinue = () => {
    if (!isFormValid) return;

    // Navigate to biometric enrollment passing form values as query params
    router.push({
      pathname: '/biometric-enrollment',
      params: {
        nid: nid.trim(),
        activationCode: activationCode.trim(),
        username: username.toLowerCase().trim(),
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.verifyIdentityTitle} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Vector Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require('../../assets/images/verify_identity_illustration.jpg')}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>

          {/* Prompt Header */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{t.letsVerifyIdentity}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t.provideInfoBelow}
            </Text>
          </View>

          {/* Form Fields Container */}
          <View style={styles.formContainer}>
            {/* Field 1: NID/BRC */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.nidBrcNumberLabel}</Text>
              <Pressable
                onPress={() => nidInputRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'nid' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  nidError && [styles.inputWrapperError, { borderColor: theme.error }],
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={22}
                  color={
                    nidError 
                      ? theme.error 
                      : (focusedField === 'nid' ? theme.primary : theme.textSecondary)
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={nidInputRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.nidPlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={nid}
                  onChangeText={handleNidChange}
                  keyboardType="number-pad"
                  onFocus={() => setFocusedField('nid')}
                  onBlur={() => setFocusedField(null)}
                />
              </Pressable>
              {nidError && <Text style={[styles.errorText, { color: theme.error }]}>{nidError}</Text>}
            </View>

            {/* Field 2: Activation Code */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.activationCodeLabel}</Text>
              <Pressable
                onPress={() => codeInputRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'code' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  codeError && [styles.inputWrapperError, { borderColor: theme.error }],
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color={
                    codeError 
                      ? theme.error 
                      : (focusedField === 'code' ? theme.primary : theme.textSecondary)
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={codeInputRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.activationCodePlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={activationCode}
                  onChangeText={handleCodeChange}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setFocusedField('code')}
                  onBlur={() => setFocusedField(null)}
                />
              </Pressable>
              {codeError && <Text style={[styles.errorText, { color: theme.error }]}>{codeError}</Text>}
            </View>

            {/* Field 3: Bank-Assigned Username */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.bankAssignedUsernameLabel}</Text>
              <Pressable
                onPress={() => usernameInputRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'username' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={focusedField === 'username' ? theme.primary : theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={usernameInputRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.usernamePlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Continue Button at the bottom */}
        <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              !isFormValid && [styles.continueButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
            ]}
            disabled={!isFormValid}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>{t.continueToBpK2}</Text>
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
  // Illustration
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  illustration: {
    width: width * 0.5,
    height: width * 0.5,
  },
  // Text prompt
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Form elements
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
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: Spacing.xs,
    marginTop: Spacing.xs,
  },
  // Bottom button section
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
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
  continueButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
