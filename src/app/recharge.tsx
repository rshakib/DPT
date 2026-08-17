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
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as api from '../services/api';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

const { width } = Dimensions.get('window');

interface Operator {
  key: string;
  name: string;
  logoChar: string;
  color: string;
}

const OPERATORS: Operator[] = [
  { key: 'gp', name: 'Grameenphone', logoChar: 'G', color: '#00A4E4' },
  { key: 'robi', name: 'Robi', logoChar: 'R', color: '#FF3838' },
  { key: 'banglalink', name: 'Banglalink', logoChar: 'B', color: '#FF9500' },
  { key: 'airtel', name: 'Airtel', logoChar: 'A', color: '#E60000' },
  { key: 'teletalk', name: 'Teletalk', logoChar: 'T', color: '#3BA53A' },
];

const PRESET_AMOUNTS = [20, 50, 100, 200, 500];

export default function MobileRecharge() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Form inputs
  const [selectedOperator, setSelectedOperator] = useState<string>('gp');
  const [mobileNumber, setMobileNumber] = useState('');
  const [amount, setAmount] = useState('');

  // Keyboard active states
  const [focusedField, setFocusedField] = useState<'mobile' | 'amount' | null>(null);
  const [mobileTouched, setMobileTouched] = useState(false);

  const mobileRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);

  const handleMobileNumberChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setMobileNumber(cleaned);
  };

  const handleAmountChange = (text: string) => {
    // Only allow positive integers/floats
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setAmount(cleaned);
  };

  const handlePresetSelect = (val: number) => {
    setAmount(val.toString());
  };

  const isMobileValid = mobileNumber.length === 11 && mobileNumber.startsWith('01');
  const showMobileError = mobileTouched && !isMobileValid && mobileNumber.length > 0;

  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount >= 10;
  const showAmountError = amount.length > 0 && !isAmountValid;

  const [isChecking, setIsChecking] = useState(false);

  const isFormValid = isMobileValid && isAmountValid;

  const handleProceed = async () => {
    if (!isFormValid || isChecking) return;

    setIsChecking(true);
    const result = await api.checkReceiver('mobile');
    setIsChecking(false);

    if (result.success) {
      const op = OPERATORS.find((o) => o.key === selectedOperator);
      const displayOperator = op ? op.name : selectedOperator;

      router.push({
        pathname: '/recharge-confirm',
        params: {
          receiverUsername: 'mobile',
          mobileNumber,
          operator: displayOperator,
          amount: parsedAmount.toFixed(2),
        },
      });
    } else {
      Alert.alert(
        language === 'en' ? 'Recharge Unavailable' : 'রিচার্জ সেবা বন্ধ',
        language === 'en'
          ? 'Recharge service temporarily unavailable. Please try again later.'
          : 'রিচার্জ সেবা সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।'
      );
    }
  };

  const getMobileBorder = () => {
    if (focusedField === 'mobile') return styles.inputWrapperFocused;
    if (showMobileError) return styles.inputWrapperError;
    if (isMobileValid) return styles.inputWrapperSuccess;
    return null;
  };

  const getAmountBorder = () => {
    if (focusedField === 'amount') return styles.inputWrapperFocused;
    if (showAmountError) return styles.inputWrapperError;
    if (isAmountValid) return styles.inputWrapperSuccess;
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.mobileRecharge} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Fields Container */}
          <View style={styles.formContainer}>
            
            {/* Operator Selection */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.selectOperatorLabel}</Text>
              <View style={styles.operatorRow}>
                {OPERATORS.map((op) => {
                  const isCurrentSelected = selectedOperator === op.key;
                  return (
                    <TouchableOpacity
                      key={op.key}
                      style={[
                        styles.operatorChip,
                        { borderColor: theme.border, backgroundColor: theme.background },
                        isCurrentSelected && [styles.operatorChipSelected, { borderColor: theme.primary, backgroundColor: theme.primaryLight }],
                      ]}
                      onPress={() => setSelectedOperator(op.key)}
                      activeOpacity={0.8}
                    >
                      {isCurrentSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      )}
                      <View style={[styles.operatorCircle, { backgroundColor: op.color }]}>
                        <Text style={styles.operatorLogoText}>{op.logoChar}</Text>
                      </View>
                      <Text style={[styles.operatorName, { color: theme.text }]}>{op.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Field 1: Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.mobileNumberLabel}</Text>
              <Pressable
                onPress={() => mobileRef.current?.focus()}
                style={[
                  styles.inputWrapper, 
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  getMobileBorder() === styles.inputWrapperFocused && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  getMobileBorder() === styles.inputWrapperError && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                  getMobileBorder() === styles.inputWrapperSuccess && [styles.inputWrapperSuccess, { borderColor: theme.success, backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#F5FFF9' }],
                ]}
              >
                <Ionicons
                  name="call-outline"
                  size={22}
                  color={
                    showMobileError
                      ? theme.error
                      : isMobileValid
                      ? theme.success
                      : focusedField === 'mobile'
                      ? theme.primary
                      : theme.textSecondary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={mobileRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="01XXXXXXXXX"
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={mobileNumber}
                  onChangeText={handleMobileNumberChange}
                  keyboardType="number-pad"
                  maxLength={11}
                  onFocus={() => setFocusedField('mobile')}
                  onBlur={() => {
                    setFocusedField(null);
                    setMobileTouched(true);
                  }}
                />
              </Pressable>
              
              {/* Warnings and help text */}
              {showMobileError && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>{t.enterValidMobile}</Text>
                </View>
              )}
              {!showMobileError && (
                <Text style={[styles.helpText, { color: theme.textSecondary }]}>{t.helpTextMobile}</Text>
              )}
            </View>

            {/* Field 2: Preset Amount Chips */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.selectAmountLabel}</Text>
              <View style={styles.presetsRow}>
                {PRESET_AMOUNTS.map((val) => {
                  const isCurrentPreset = amount === val.toString();
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.presetChip,
                        { borderColor: theme.border, backgroundColor: theme.background },
                        isCurrentPreset && [styles.presetChipSelected, { backgroundColor: theme.primary, borderColor: theme.primary }],
                      ]}
                      onPress={() => handlePresetSelect(val)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.presetText,
                        { color: theme.primary },
                        isCurrentPreset && styles.presetTextSelected,
                      ]}>
                        ৳{val}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Field 3: Manual Amount Entry */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.customAmountLabel}</Text>
              <Pressable
                onPress={() => amountRef.current?.focus()}
                style={[
                  styles.inputWrapper, 
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  getAmountBorder() === styles.inputWrapperFocused && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  getAmountBorder() === styles.inputWrapperError && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                  getAmountBorder() === styles.inputWrapperSuccess && [styles.inputWrapperSuccess, { borderColor: theme.success, backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#F5FFF9' }],
                ]}
              >
                <Text style={[
                  styles.currencyPrefix,
                  focusedField === 'amount' && [styles.currencyPrefixActive, { color: theme.text }]
                ]}>৳</Text>
                <TextInput
                  ref={amountRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={language === 'en' ? 'Enter amount' : 'পরিমাণ লিখুন'}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                  onFocus={() => setFocusedField('amount')}
                  onBlur={() => setFocusedField(null)}
                />
                <Text style={[styles.currencySuffix, { color: theme.primary }]}>BDT</Text>
              </Pressable>

              {/* Warnings and help text */}
              {showAmountError && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>৳10 - ৳5,000.00</Text>
                </View>
              )}
              {!showAmountError && (
                <Text style={[styles.helpText, { color: theme.textSecondary }]}>৳10 - ৳5,000.00</Text>
              )}
            </View>

          </View>
        </ScrollView>

        {/* Continue Action Button Footer */}
        <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.proceedButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              (!isFormValid || isChecking) && [styles.proceedButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
            ]}
            disabled={!isFormValid || isChecking}
            onPress={handleProceed}
            activeOpacity={0.8}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.proceedButtonText}>{t.proceedToPinVerification}</Text>
              </>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  formContainer: {
    gap: Spacing.xl,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  // Operator Grid
  operatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  operatorChip: {
    width: (width - 64) / 5.8,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: Spacing.xs,
    position: 'relative',
  },
  operatorChipSelected: {},
  checkBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  operatorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorLogoText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  operatorName: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Form input layout
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
  inputWrapperSuccess: {},
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: Spacing.xs,
    marginTop: Spacing.xs,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: Spacing.xs,
    marginTop: Spacing.xs,
  },
  feedbackError: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Preset Chips
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  presetChip: {
    width: (width - 64) / 5.6,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipSelected: {},
  presetText: {
    fontSize: 14,
    fontWeight: '700',
  },
  presetTextSelected: {
    color: '#FFFFFF',
  },
  // Currency input indicators
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A5A3C1',
    marginRight: Spacing.md,
  },
  currencyPrefixActive: {},
  currencySuffix: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.md,
  },
  // Action footer
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
  },
  proceedButton: {
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
  proceedButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  proceedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
});
