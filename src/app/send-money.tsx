import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
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
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';

export default function SendMoney() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  const { user } = useAuth();

  // Form States
  const [receiverInput, setReceiverInput] = useState('');
  const [amount, setAmount] = useState('');

  // Receiver Check States
  const [isValidating, setIsValidating] = useState(false);
  const [verifiedReceiver, setVerifiedReceiver] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Focus States
  const [focusedField, setFocusedField] = useState<'receiver' | 'amount' | null>(null);

  // Debounce Timer Ref
  const checkTimerRef = useRef<any>(null);

  // Input Refs for touch target improvements
  const receiverRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);

  // Real Limits Data from user session state & SQLite today's transactions
  const userData = user?.user || user;
  const DAILY_LIMIT = parseFloat(userData?.daily_limit || userData?.dailyLimit || 5000);
  const [spentToday, setSpentToday] = useState<number>(() => {
    return parseFloat(userData?.today_spent || userData?.todaySpent || 0);
  });

  const loadTodaySpent = async () => {
    if (user?.username) {
      const computed = await db.getTodaySpent(user.username);
      setSpentToday(computed);
    }
  };

  useEffect(() => {
    loadTodaySpent();
  }, [user?.username, user?.balance]);

  const ALREADY_SPENT = spentToday;
  const REMAINING_LIMIT = Math.max(0, DAILY_LIMIT - ALREADY_SPENT);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);

  const handleReceiverChange = (text: string) => {
    // Filter out spaces and special characters except underscores (allowing A-Z and a-z)
    const allowed = text.replace(/[^a-zA-Z0-9_]/g, '');
    setReceiverInput(allowed);
    setVerifiedReceiver(null);
    setValidationError(null);

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    if (allowed === '') {
      setIsValidating(false);
      return;
    }

    setIsValidating(true);

    // Debounce check for 500ms after user stops typing
    checkTimerRef.current = setTimeout(async () => {
      const cleaned = allowed.trim().toLowerCase();

      // client-side self-transaction check using user.username from AuthContext
      if (cleaned === user?.username?.toLowerCase()) {
        setIsValidating(false);
        setValidationError(t.selfTxNotAllowed);
        return;
      }

      const result = await api.checkReceiver(cleaned);
      setIsValidating(false);

      if (result.success) {
        setVerifiedReceiver(`@${cleaned}`);
      } else {
        setValidationError(result.message || t.receiverNotFoundMsg);
      }
    }, 500);
  };

  const handleAmountChange = (text: string) => {
    // Only allow numeric digits and one decimal dot
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    
    // Cap at 2 decimal places and prevent multiple dots
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setAmount(cleaned);
  };

  // Parsed calculations
  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount > 0 && parsedAmount <= REMAINING_LIMIT;

  // Final Form Validation
  const isFormValid =
    verifiedReceiver !== null &&
    isAmountValid &&
    !isValidating;

  const handleProceed = () => {
    if (!isFormValid) return;

    // Navigate to send-money-confirm, forwarding inputs as query parameters
    router.push({
      pathname: '/send-money-confirm',
      params: {
        receiverUsername: verifiedReceiver || receiverInput,
        amount: parsedAmount.toFixed(2),
        type: 'user_transfer',
      },
    });
  };

  // Determine receiver outline border style
  const getReceiverBorder = () => {
    if (focusedField === 'receiver') return styles.inputWrapperFocused;
    if (validationError) return styles.inputWrapperError;
    if (verifiedReceiver) return styles.inputWrapperSuccess;
    return null;
  };

  // Determine amount outline border style
  const getAmountBorder = () => {
    if (focusedField === 'amount') return styles.inputWrapperFocused;
    if (amount.length > 0 && !isAmountValid) return styles.inputWrapperError;
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.sendMoneyTitle} />

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
            
            {/* Field 1: Receiver's Username */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.receiverUsernameLabel}</Text>
              <Pressable
                onPress={() => receiverRef.current?.focus()}
                style={[
                  styles.inputWrapper, 
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  getReceiverBorder() === styles.inputWrapperFocused && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  getReceiverBorder() === styles.inputWrapperError && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                  getReceiverBorder() === styles.inputWrapperSuccess && [styles.inputWrapperSuccess, { borderColor: theme.success, backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#F5FFF9' }],
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={
                    validationError
                      ? theme.error
                      : verifiedReceiver
                      ? theme.success
                      : focusedField === 'receiver'
                      ? theme.primary
                      : theme.textSecondary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={receiverRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.usernamePlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={receiverInput}
                  onChangeText={handleReceiverChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('receiver')}
                  onBlur={() => setFocusedField(null)}
                />
              </Pressable>

              {/* Live Debounced Status Messages */}
              {isValidating && (
                <View style={styles.feedbackRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.feedbackChecking, { color: theme.textSecondary }]}>{t.checkingUsername}</Text>
                </View>
              )}
              {verifiedReceiver && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.feedbackSuccess, { color: theme.success }]}>{t.receiverVerifiedMsg}: {verifiedReceiver}</Text>
                </View>
              )}
              {validationError && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>{validationError}</Text>
                </View>
              )}
            </View>

            {/* Field 2: Amount (BDT) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.amountBdtLabel}</Text>
              <Pressable
                onPress={() => amountRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  getAmountBorder() === styles.inputWrapperFocused && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  getAmountBorder() === styles.inputWrapperError && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                ]}
              >
                <Text style={[
                  styles.currencyPrefix,
                  focusedField === 'amount' && [styles.currencyPrefixActive, { color: theme.text }]
                ]}>৳</Text>
                <TextInput
                  ref={amountRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="0.00"
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                  onFocus={() => setFocusedField('amount')}
                  onBlur={() => setFocusedField(null)}
                />
                <Text style={[styles.currencySuffix, { color: theme.primary }]}>BDT</Text>
              </Pressable>

              {/* Amount Warnings */}
              {amount.length > 0 && parsedAmount > REMAINING_LIMIT && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>
                    {t.amountExceedsLimit} ৳{REMAINING_LIMIT.toLocaleString()}
                  </Text>
                </View>
              )}
              {amount.length > 0 && parsedAmount <= 0 && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>{t.checkCredentialsRetry}</Text>
                </View>
              )}
              {(!amount || (parsedAmount > 0 && parsedAmount <= REMAINING_LIMIT)) && (
                <Text style={[styles.helpText, { color: theme.textSecondary }]}>৳10 - ৳{REMAINING_LIMIT.toLocaleString()}</Text>
              )}
            </View>

            {/* Daily limit usage bar */}
            <View style={[styles.limitCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.limitHeaderRow}>
                <Text style={[styles.limitTitle, { color: theme.text }]}>Daily Limit Usage</Text>
                <Text style={[styles.limitRemaining, { color: theme.primary }]}>
                  ৳{REMAINING_LIMIT.toLocaleString()} {t.remainingLabel.toLowerCase()}
                </Text>
              </View>
              {/* Progress track */}
              <View style={[styles.limitTrack, { backgroundColor: isDarkMode ? '#333' : '#EBE8FF' }]}>
                <View
                  style={[
                    styles.limitFill,
                    { width: `${(ALREADY_SPENT / DAILY_LIMIT) * 100}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <View style={styles.limitFooterRow}>
                <Text style={styles.limitLabel}>{t.spentTodayLabel}: ৳{ALREADY_SPENT.toLocaleString()}</Text>
                <Text style={styles.limitLabel}>{t.dailyLimitLabel}: ৳{DAILY_LIMIT.toLocaleString()}</Text>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* Sticky Proceed Action Button */}
        <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.proceedButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              !isFormValid && [styles.proceedButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
            ]}
            disabled={!isFormValid}
            onPress={handleProceed}
            activeOpacity={0.8}
          >
            <Text style={styles.proceedButtonText}>{t.proceedToPinVerification}</Text>
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
  // Feedback Rows
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: Spacing.xs,
    marginTop: Spacing.xs,
  },
  feedbackChecking: {
    fontSize: 12,
    fontWeight: '500',
  },
  feedbackSuccess: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackError: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    flex: 1,
  },
  // Limit progress card
  limitCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  limitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  limitRemaining: {
    fontSize: 12,
    fontWeight: '700',
  },
  limitTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    borderRadius: 4,
  },
  limitFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Bottom Sticky Action Button
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
  },
  proceedButton: {
    height: 60,
    borderRadius: 16,
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
});
