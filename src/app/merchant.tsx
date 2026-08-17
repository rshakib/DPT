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
import * as api from '../services/api';

interface Merchant {
  id: string;
  name: string;
  handle: string;
  iconName: any;
}

// Popular Merchants List
const POPULAR_MERCHANTS: Merchant[] = [
  { id: 'm-1', name: 'SuperMart', handle: '@supermart', iconName: 'cart-outline' },
  { id: 'm-2', name: 'TechHaven', handle: '@techhaven', iconName: 'laptop-outline' },
  { id: 'm-3', name: 'CityCafe', handle: '@citycafe', iconName: 'cafe-outline' },
];

export default function MerchantPayment() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Form inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [amount, setAmount] = useState('');

  // Selected merchant profile
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);

  // Search loader & validation feedback states
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Keyboard active states
  const [focusedField, setFocusedField] = useState<'search' | 'amount' | null>(null);

  const searchRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const checkTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);

  const performSearch = async (query: string) => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return;

    setIsSearching(true);
    setSearchError(null);
    setSelectedMerchant(null);

    const merchantHandle = cleanQuery.startsWith('@') ? cleanQuery.slice(1) : cleanQuery;

    try {
      const result = await api.checkReceiver(merchantHandle);
      setIsSearching(false);

      if (result.success) {
        // Map popular display names or construct a fallback name
        let name = merchantHandle.charAt(0).toUpperCase() + merchantHandle.slice(1);
        let iconName: any = 'basket-outline';

        const match = POPULAR_MERCHANTS.find(
          (m) => m.handle.toLowerCase().replace('@', '') === merchantHandle
        );

        if (match) {
          name = match.name;
          iconName = match.iconName;
        }

        setSelectedMerchant({
          id: 'merchant-' + merchantHandle,
          name,
          handle: '@' + merchantHandle,
          iconName,
        });
      } else {
        setSearchError(t.merchantNotFound || 'Merchant not found');
      }
    } catch (e: any) {
      setIsSearching(false);
      setSearchError(e.message || 'Connection error occurred.');
    }
  };

  const handleSearchQueryChange = (text: string) => {
    // Strip illegal characters for user handles
    const filtered = text.replace(/[^a-zA-Z0-9@_]/g, '');
    setSearchQuery(filtered);
    setSelectedMerchant(null);
    setSearchError(null);

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    if (filtered.trim() === '') {
      setIsSearching(false);
      return;
    }

    // Auto-search 700ms after user stops typing
    checkTimerRef.current = setTimeout(() => {
      performSearch(filtered);
    }, 700);
  };

  const handleSelectMerchant = (merchant: Merchant) => {
    setSelectedMerchant(merchant);
    setSearchQuery(merchant.handle);
    setSearchError(null);
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
  };

  const handleAmountChange = (text: string) => {
    // Only allow positive float/decimals
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setAmount(cleaned);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount > 0;

  const isFormValid =
    selectedMerchant !== null &&
    isAmountValid &&
    !isSearching;

  const handleProceed = () => {
    if (!isFormValid || !selectedMerchant) return;

    const cleanHandle = selectedMerchant.handle.startsWith('@')
      ? selectedMerchant.handle.slice(1)
      : selectedMerchant.handle;

    // Navigate to merchant-confirm passing params
    router.push({
      pathname: '/merchant-confirm',
      params: {
        merchantName: selectedMerchant.name,
        receiverUsername: cleanHandle,
        amount: parsedAmount.toFixed(2),
      },
    });
  };

  const getSearchBorder = () => {
    if (focusedField === 'search') return styles.inputWrapperFocused;
    if (searchError) return styles.inputWrapperError;
    if (selectedMerchant) return styles.inputWrapperSuccess;
    return null;
  };

  const getAmountBorder = () => {
    if (focusedField === 'amount') return styles.inputWrapperFocused;
    if (amount.length > 0 && !isAmountValid) return styles.inputWrapperError;
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.merchantPayment} />

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
            
            {/* Field 1: Search Merchant */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.searchMerchantLabel}</Text>
              <Pressable
                onPress={() => searchRef.current?.focus()}
                style={[
                  styles.inputWrapper, 
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  getSearchBorder() === styles.inputWrapperFocused && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                  getSearchBorder() === styles.inputWrapperError && [styles.inputWrapperError, { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' }],
                  getSearchBorder() === styles.inputWrapperSuccess && [styles.inputWrapperSuccess, { borderColor: theme.success, backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#F5FFF9' }],
                ]}
              >
                <TextInput
                  ref={searchRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t.searchMerchantPlaceholder}
                  placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={() => performSearch(searchQuery)}
                  onFocus={() => setFocusedField('search')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity onPress={() => performSearch(searchQuery)} style={styles.searchIconButton}>
                  <Ionicons
                    name="search"
                    size={22}
                    color={
                      searchError
                        ? theme.error
                        : selectedMerchant
                        ? theme.success
                        : theme.primary
                    }
                  />
                </TouchableOpacity>
              </Pressable>

              {/* Status and feedback warnings */}
              {isSearching && (
                <View style={styles.feedbackRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.feedbackChecking, { color: theme.textSecondary }]}>{t.searchingMerchant}</Text>
                </View>
              )}
              {searchError && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>{searchError}</Text>
                </View>
              )}
            </View>

            {/* Popular Merchants Grid / Row */}
            <View style={styles.popularContainer}>
              <Text style={[styles.popularLabel, { color: theme.text }]}>{t.popularMerchantsLabel}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularChipsScroll}
              >
                {POPULAR_MERCHANTS.map((m) => {
                  const isCurrentSelected = selectedMerchant?.handle.toLowerCase() === m.handle.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.merchantChip,
                        { borderColor: theme.border, backgroundColor: theme.background },
                        isCurrentSelected && [styles.merchantChipSelected, { borderColor: theme.primary, backgroundColor: theme.primaryLight }],
                      ]}
                      onPress={() => handleSelectMerchant(m)}
                      activeOpacity={0.8}
                    >
                      <View style={[
                        styles.chipIconWrapper,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                        isCurrentSelected && [styles.chipIconSelected, { backgroundColor: theme.primary, borderColor: theme.primary }],
                      ]}>
                        <Ionicons
                          name={m.iconName}
                          size={18}
                          color={isCurrentSelected ? '#FFFFFF' : theme.primary}
                        />
                      </View>
                      <View>
                        <Text style={[
                          styles.chipName,
                          { color: theme.text },
                          isCurrentSelected && [styles.chipNameSelected, { color: theme.primary }],
                        ]}>
                          {m.name}
                        </Text>
                        <Text style={[
                          styles.chipHandle,
                          { color: theme.textSecondary },
                          isCurrentSelected && [styles.chipHandleSelected, { color: theme.primary }],
                        ]}>
                          {m.handle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Selected Merchant Info Card */}
            {selectedMerchant && (
              <View style={[styles.merchantConfirmCard, { backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.05)' : '#F5FFF9', borderColor: isDarkMode ? 'rgba(9, 196, 135, 0.2)' : '#D6F5E3' }]}>
                <View style={styles.confirmLeft}>
                  <View style={[styles.confirmIconCircle, { backgroundColor: isDarkMode ? '#2C2754' : '#E6FFF0' }]}>
                    <Ionicons name={selectedMerchant.iconName} size={22} color={theme.success} />
                  </View>
                  <View>
                    <Text style={[styles.confirmName, { color: theme.text }]}>{selectedMerchant.name}</Text>
                    <Text style={[styles.confirmHandle, { color: theme.textSecondary }]}>{selectedMerchant.handle}</Text>
                  </View>
                </View>
                <View style={[styles.confirmBadge, { backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#E6FFF0' }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.confirmBadgeText, { color: theme.success }]}>{language === 'en' ? 'Selected' : 'নির্বাচিত'}</Text>
                </View>
              </View>
            )}

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
              {amount.length > 0 && parsedAmount <= 0 && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.feedbackError, { color: theme.error }]}>{t.checkCredentialsRetry}</Text>
                </View>
              )}
            </View>

          </View>
        </ScrollView>

        {/* Proceed Action Button */}
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
            <Ionicons name="lock-closed" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.proceedButtonText}>{t.proceedToPayment}</Text>
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
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  searchIconButton: {
    padding: Spacing.xs,
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
  // Feedback status
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
  feedbackError: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Popular chips row
  popularContainer: {
    gap: Spacing.md,
  },
  popularLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  popularChipsScroll: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  merchantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: Spacing.sm,
  },
  merchantChipSelected: {},
  chipIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipIconSelected: {},
  chipName: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipNameSelected: {},
  chipHandle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  chipHandleSelected: {},
  // Selected Card info
  merchantConfirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.md,
  },
  confirmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  confirmIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmName: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmHandle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  confirmBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Proceed Action button footer
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
