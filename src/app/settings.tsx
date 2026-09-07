import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { saveDisplayName, getDisplayName } from '../services/db';

const { width } = Dimensions.get('window');

export default function AppSettings() {
  const router = useRouter();
  const { theme, activeThemeName, setThemeName, isDarkMode, toggleDarkMode } = useAppTheme();
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];
  const { user, updateUser } = useAuth();

  // Local settings states (initialized with current context values)
  const [localDarkMode, setLocalDarkMode] = useState(isDarkMode);
  const [displayName, setDisplayName] = useState(user?.full_name || user?.username || '');
  const [localLanguage, setLocalLanguage] = useState(language === 'en' ? 'English' : 'Bangla');
  const [currency, setCurrency] = useState('BDT');

  // Load display name from SQLite on mount
  useEffect(() => {
    const loadDisplayName = async () => {
      if (user?.username) {
        const savedName = await getDisplayName(user.username);
        if (savedName) {
          setDisplayName(savedName);
        }
      }
    };
    loadDisplayName();
  }, [user?.username]);

  // Keep local dark mode state synchronized with context isDarkMode changes
  useEffect(() => {
    setLocalDarkMode(isDarkMode);
  }, [isDarkMode]);

  // Keep local language state synchronized with context language changes
  useEffect(() => {
    setLocalLanguage(language === 'en' ? 'English' : 'Bangla');
  }, [language]);

  // Focus state for active input box style
  const [isNameFocused, setIsNameFocused] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  // Picker modal states
  const [activePicker, setActivePicker] = useState<'language' | 'currency' | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastVisible(false);
    });
  };

  const handleSavePreferences = async () => {
    // 1. Commit theme changes app-wide if toggle state changed
    if (localDarkMode !== isDarkMode) {
      toggleDarkMode();
    }

    // 2. Commit language changes app-wide if language changed
    const targetLangCode = localLanguage === 'English' ? 'en' : 'bn';
    if (targetLangCode !== language) {
      toggleLanguage(targetLangCode);
    }

    // Display name is read-only (from full_name), no save needed

    triggerToast(t.prefSaved || 'Preferences saved successfully!');
  };

  const handleDiscardChanges = () => {
    // Reset local states back to current context/default values
    setLocalDarkMode(isDarkMode);
    setDisplayName(user?.full_name || user?.username || '');
    setLocalLanguage(language === 'en' ? 'English' : 'Bangla');
    setCurrency('BDT');

    triggerToast(t.changesDiscarded || 'Changes discarded');
  };

  const openPicker = (type: 'language' | 'currency') => {
    setActivePicker(type);
  };

  const selectPickerOption = (value: string) => {
    if (activePicker === 'language') {
      setLocalLanguage(value);
    } else if (activePicker === 'currency') {
      setCurrency(value);
    }
    setActivePicker(null);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.settingsTitle || 'Settings'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1: Quick Toggles & Theme Mode */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              {t.themePreferences || 'Theme Preferences'}
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              {/* Dark Mode Switch */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={[styles.iconWrapper, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name="moon-outline" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={[styles.settingTitle, { color: theme.text }]}>
                      {t.darkMode || 'Dark Mode'}
                    </Text>
                    <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                      {t.applyDarkTheme || 'Apply dark theme across the system'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={localDarkMode}
                  onValueChange={setLocalDarkMode}
                  trackColor={{ false: isDarkMode ? '#1E1E1E' : '#ECE9FC', true: theme.primaryLight }}
                  thumbColor={localDarkMode ? theme.primary : '#C6C5DB'}
                />
              </View>

              <View style={[styles.optionDivider, { backgroundColor: theme.border }]} />

              {/* Theme Palette Switch (Classic vs Sol) */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={[styles.iconWrapper, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name="color-palette-outline" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={[styles.settingTitle, { color: theme.text }]}>
                      Theme Preset
                    </Text>
                    <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                      {activeThemeName === 'sol' ? 'Sol Theme (Orange & Charcoal)' : 'Classic Theme (Purple Brand)'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.themeToggleButton, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                  onPress={() => setThemeName(activeThemeName === 'classic' ? 'sol' : 'classic')}
                >
                  <Text style={[styles.themeToggleText, { color: theme.primary }]}>
                    {activeThemeName === 'classic' ? 'Classic' : 'Sol'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 2: Account Preferences Form */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              {t.accountConfig || 'Account Configuration'}
            </Text>
            
            <View style={[styles.formCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              {/* Full Name (Read-only from registration) */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {language === 'en' ? 'Full Name' : 'পূর্ণ নাম'}
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: isDarkMode ? '#1A1B20' : '#F4F3F8', borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="person-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <Text style={[styles.textInput, { color: theme.textSecondary, paddingVertical: 16 }]}>
                    {displayName || user?.username || 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Language Selector Trigger */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {t.language || 'Language'}
                </Text>
                <TouchableOpacity
                  style={[styles.selectorTrigger, { backgroundColor: isDarkMode ? '#121212' : '#FBFBFF', borderColor: theme.border }]}
                  onPress={() => openPicker('language')}
                  activeOpacity={0.8}
                >
                  <View style={styles.selectorLeft}>
                    <Ionicons name="globe-outline" size={20} color={theme.primary} />
                    <Text style={[styles.selectorValueText, { color: theme.text }]}>{localLanguage}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#A5A3C1" />
                </TouchableOpacity>
              </View>

              {/* Currency Selector Trigger */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {t.defaultCurrency || 'Default Currency'}
                </Text>
                <TouchableOpacity
                  style={[styles.selectorTrigger, { backgroundColor: isDarkMode ? '#121212' : '#FBFBFF', borderColor: theme.border }]}
                  onPress={() => openPicker('currency')}
                  activeOpacity={0.8}
                >
                  <View style={styles.selectorLeft}>
                    <Ionicons name="cash-outline" size={20} color={theme.primary} />
                    <Text style={[styles.selectorValueText, { color: theme.text }]}>{currency}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#A5A3C1" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Button Row at Bottom */}
        <View style={[styles.buttonContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleSavePreferences}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.saveButtonText}>{t.savePreferences || 'Save Preferences'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.discardButton, { borderColor: theme.primary, backgroundColor: theme.background }]}
            onPress={handleDiscardChanges}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.primary} style={styles.buttonIcon} />
            <Text style={[styles.discardButtonText, { color: theme.primary }]}>
              {t.discardChanges || 'Discard Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Selector Dropdown bottom sheet modal */}
      <Modal
        visible={activePicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissTrigger} onPress={() => setActivePicker(null)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalDragHandle, { backgroundColor: theme.border }]} />

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {activePicker === 'language' ? (t.selectLanguage || 'Select Language') : (t.selectCurrency || 'Select Currency')}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {activePicker === 'language'
                ? (t.chooseLanguage || 'Choose your preferred display language')
                : (t.chooseCurrency || 'Choose your default display wallet currency')}
            </Text>

            {/* List Options */}
            <View style={[styles.optionsList, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
              {activePicker === 'language' ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      { backgroundColor: theme.cardBg },
                      localLanguage === 'English' && { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF' }
                    ]}
                    onPress={() => selectPickerOption('English')}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: theme.textSecondary },
                      localLanguage === 'English' && { color: theme.primary, fontWeight: '700' }
                    ]}>
                      English
                    </Text>
                    {localLanguage === 'English' && (
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                  <View style={[styles.optionDivider, { backgroundColor: theme.border }]} />
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      { backgroundColor: theme.cardBg },
                      localLanguage === 'Bangla' && { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF' }
                    ]}
                    onPress={() => selectPickerOption('Bangla')}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: theme.textSecondary },
                      localLanguage === 'Bangla' && { color: theme.primary, fontWeight: '700' }
                    ]}>
                      Bangla (বাংলা)
                    </Text>
                    {localLanguage === 'Bangla' && (
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      { backgroundColor: theme.cardBg },
                      currency === 'BDT' && { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF' }
                    ]}
                    onPress={() => selectPickerOption('BDT')}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: theme.textSecondary },
                      currency === 'BDT' && { color: theme.primary, fontWeight: '700' }
                    ]}>
                      BDT (৳) - Bangladeshi Taka
                    </Text>
                    {currency === 'BDT' && (
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                  <View style={[styles.optionDivider, { backgroundColor: theme.border }]} />
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      { backgroundColor: theme.cardBg },
                      currency === 'USD' && { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF' }
                    ]}
                    onPress={() => selectPickerOption('USD')}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: theme.textSecondary },
                      currency === 'USD' && { color: theme.primary, fontWeight: '700' }
                    ]}>
                      USD ($) - US Dollar
                    </Text>
                    {currency === 'USD' && (
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: isDarkMode ? '#2C2754' : '#F5F5F7' }]}
              onPress={() => setActivePicker(null)}
            >
              <Text style={styles.modalCancelText}>{t.close || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
          <View style={styles.toastCard}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
    gap: Spacing.xl,
  },
  // Section wrappers
  sectionContainer: {
    gap: Spacing.md,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.xs,
  },
  // Theme card
  settingsCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  themeToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Configurations card
  formCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  inputWrapper: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  // Selector triggers
  selectorTrigger: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selectorValueText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Actions at the bottom
  buttonContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  saveButton: {
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
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  discardButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
  // Picker modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 13, 44, 0.4)',
    justifyContent: 'flex-end',
  },
  modalDismissTrigger: {
    flex: 1,
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.huge,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
    marginBottom: Spacing.xl,
  },
  optionsList: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDivider: {
    height: 1.5,
  },
  modalCancelButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Custom toast
  toastContainer: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#0E0D2C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    shadowColor: '#0E0D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
