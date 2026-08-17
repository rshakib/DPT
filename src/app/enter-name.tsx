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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

const { width } = Dimensions.get('window');

export default function EnterName() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Retrieve incoming navigation parameters
  const params = useLocalSearchParams();
  const { nid = '', activationCode = '', username = '' } = params;

  // Form state
  const [fullName, setFullName] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | null>(null);

  const nameInputRef = useRef<TextInput>(null);

  const isFormValid = fullName.trim().length >= 2;

  const handleContinue = () => {
    if (!isFormValid) return;

    router.push({
      pathname: '/create-password',
      params: {
        nid: String(nid),
        activationCode: String(activationCode),
        username: String(username),
        fullName: fullName.trim(),
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={language === 'en' ? 'Personal Information' : 'ব্যক্তিগত তথ্য'} />

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
              source={require('../../assets/images/verify_identity_illustration.jpg')}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>

          {/* Header Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]}>
              {language === 'en' ? 'What is your full name?' : 'আপনার পুরো নাম কি?'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {language === 'en'
                ? 'Please enter your full legal name as shown on your NID card.'
                : 'আপনার এনআইডি কার্ডের মতো আপনার পুরো নাম লিখুন।'}
            </Text>
          </View>

          {/* Input Form */}
          <View style={styles.formContainer}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                {language === 'en' ? 'Full Name' : 'পুরো নাম'}
              </Text>
              <Pressable
                onPress={() => nameInputRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  focusedField === 'name' && [
                    styles.inputWrapperFocused,
                    { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary },
                  ],
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={focusedField === 'name' ? theme.primary : theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={nameInputRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={language === 'en' ? 'e.g. Riajul Hasan Shakib' : 'উদাহরণ: রিয়াজুল হাসান সাকিব'}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Continue Button */}
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
            <Text style={styles.continueButtonText}>
              {language === 'en' ? 'Continue to Create PIN' : 'পিন তৈরি করতে এগিয়ে যান'}
            </Text>
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
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  illustration: {
    width: width * 0.45,
    height: width * 0.45,
  },
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
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
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
