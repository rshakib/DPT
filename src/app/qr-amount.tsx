import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Pressable,
  ScrollView,
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

const QUICK_AMOUNTS = [100, 200, 500, 1000];

export default function QRAmount() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Retrieve parameters passed from QRPay scanner/manual view
  const params = useLocalSearchParams();
  const merchantName = Array.isArray(params.merchantName) ? params.merchantName[0] : params.merchantName || 'Merchant';
  const merchantHandle = Array.isArray(params.merchantHandle) ? params.merchantHandle[0] : params.merchantHandle || '@merchant';

  // Amount & optional reference notes states
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);

  const amountRef = useRef<TextInput>(null);

  const handleAmountChange = (text: string) => {
    // Only allow positive numbers and decimals
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setAmount(cleaned);
  };

  const handlePresetSelect = (val: number) => {
    setAmount(val.toString());
  };

  const isAmountValid = (parseFloat(amount) || 0) >= 10;

  const handleProceed = () => {
    if (!isAmountValid) return;

    router.push({
      pathname: '/qr-pay-confirm',
      params: {
        merchantName,
        merchantHandle,
        amount: parseFloat(amount).toFixed(2),
        note,
      },
    });
  };

  // Adjust amount font sizes dynamically as length grows
  const getAmountFontSize = () => {
    if (amount.length > 8) return 32;
    if (amount.length > 5) return 40;
    return 48;
  };

  const getSymbolFontSize = () => {
    if (amount.length > 8) return 24;
    if (amount.length > 5) return 30;
    return 36;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.qrPay} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
        >
          {/* Merchant Header Details Card */}
          <View style={[styles.merchantCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={[styles.merchantIconWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="person-outline" size={24} color={theme.primary} />
            </View>
            <View style={styles.merchantInfo}>
              <Text style={[styles.merchantName, { color: theme.text }]}>{merchantName}</Text>
              <Text style={[styles.merchantHandle, { color: theme.textSecondary }]}>{merchantHandle}</Text>
            </View>
          </View>

          {/* Amount Large Entry Section */}
          <View style={styles.amountSection}>
            <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>{t.howMuchPayQuestion}</Text>
            
            <Pressable
              onPress={() => amountRef.current?.focus()}
              style={[
                styles.amountInputRow,
                { borderBottomColor: theme.border },
                isAmountFocused && [styles.amountInputRowFocused, { borderBottomColor: theme.primary }],
              ]}
            >
              <Text style={[styles.bdtSymbol, { color: theme.text, fontSize: getSymbolFontSize() }]}>৳</Text>
              <TextInput
                ref={amountRef}
                style={[styles.amountInput, { color: theme.text, fontSize: getAmountFontSize() }]}
                placeholder="0.00"
                placeholderTextColor={isDarkMode ? '#7E7C9D' : '#C6C5DB'}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                autoFocus={true}
                onFocus={() => setIsAmountFocused(true)}
                onBlur={() => setIsAmountFocused(false)}
              />
            </Pressable>
          </View>

          {/* Quick preset chips */}
          <View style={styles.presetsContainer}>
            {QUICK_AMOUNTS.map((val) => {
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

          {/* Note Input */}
          <View style={styles.noteContainer}>
            <Text style={[styles.noteLabel, { color: theme.text }]}>{t.addNoteOptional}</Text>
            <View style={[styles.noteInputWrapper, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color="#A5A3C1" style={styles.noteIcon} />
              <TextInput
                style={[styles.noteInput, { color: theme.text }]}
                placeholder={t.dinnerPaymentPlaceholder}
                placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                value={note}
                onChangeText={setNote}
                maxLength={60}
              />
            </View>
          </View>

        </ScrollView>

        {/* Sticky Proceed Button */}
        <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.proceedButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              !isAmountValid && [styles.proceedButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
            ]}
            disabled={!isAmountValid}
            onPress={handleProceed}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.proceedButtonText}>{t.proceedToPay}</Text>
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
    alignItems: 'center',
  },
  // Merchant details card
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.huge,
  },
  merchantIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '800',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantHandle: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Amount Section
  amountSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    width: width * 0.85,
    maxWidth: '100%',
    paddingBottom: Spacing.xs,
  },
  amountInputRowFocused: {},
  bdtSymbol: {
    fontWeight: '800',
    marginRight: Spacing.xs,
  },
  amountInput: {
    fontWeight: '800',
    textAlign: 'left',
    minWidth: 100,
    flexShrink: 1,
    height: 70,
  },
  // Quick presets row
  presetsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.huge,
  },
  presetChip: {
    width: (width - 64) / 4.5,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipSelected: {},
  presetText: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetTextSelected: {
    color: '#FFFFFF',
  },
  // Note Entry
  noteContainer: {
    width: '100%',
    gap: Spacing.xs,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  noteInputWrapper: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
  },
  noteIcon: {
    marginRight: Spacing.sm,
  },
  noteInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  // Action footer
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    width: '100%',
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
