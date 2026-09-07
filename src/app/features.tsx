import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

type SectionKey = 'email' | 'qr' | 'nfc' | 'card';

export default function Features() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Accordion state: only one section can be open at a time
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>(null);

  const toggleSection = (section: SectionKey) => {
    // Configure standard smooth layout transition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleEmailVerification = () => {
    // MOCK — wire real email verification API later
    Alert.alert(
      language === 'en' ? 'Verification Sent' : 'যাচাইকরণ পাঠানো হয়েছে',
      t.verificationEmailSentAlert
    );
  };

  const handleStartScanner = () => {
    // Navigate to the existing QR scanner screen
    router.push('/qr-pay');
  };

  const handleNfcTransfer = () => {
    // Navigate to real NFC P2P transfer screen
    router.push('/nfc-transfer');
  };

  const handleLinkCard = () => {
    // MOCK — real card linking flow later
    Alert.alert(
      language === 'en' ? 'Card Management' : 'কার্ড ম্যানেজমেন্ট',
      t.cardLinkingComingSoonAlert
    );
  };

  const handleBack = () => {
    router.back();
  };

  // Render helper for accordion card
  const renderAccordionItem = (
    key: SectionKey,
    title: string,
    description: string,
    buttonText: string,
    onButtonPress: () => void,
    iconName: any
  ) => {
    const isExpanded = expandedSection === key;
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.border,
          },
          isExpanded && {
            borderColor: theme.primary,
            shadowColor: theme.primary,
          },
        ]}
      >
        {/* Accordion Header */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleSection(key)}
          activeOpacity={0.7}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name={iconName} size={20} color={theme.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          </View>

          {/* Rotating Chevron indicator */}
          <View
            style={{
              transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
            }}
          >
            <Ionicons name="chevron-forward-outline" size={20} color={theme.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Expandable content area */}
        {isExpanded && (
          <View style={styles.cardContent}>
            <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
              {description}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
              onPress={onButtonPress}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.additionalFeaturesTitle} onBackPress={handleBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Email Verification */}
        {renderAccordionItem(
          'email',
          t.emailVerificationTitle,
          t.emailVerificationDesc,
          t.sendVerificationEmailButton,
          handleEmailVerification,
          'mail-outline'
        )}

        {/* Section 2: QR/Barcode Scanner */}
        {renderAccordionItem(
          'qr',
          t.qrBarcodeScannerTitle,
          t.qrBarcodeScannerDesc,
          t.startScannerButton,
          handleStartScanner,
          'qr-code-outline'
        )}

        {/* Section 3: NFC Payment */}
        {renderAccordionItem(
          'nfc',
          t.nfcPaymentTitle,
          t.nfcPaymentDesc,
          language === 'en' ? 'Start NFC Transfer' : 'NFC ট্রান্সফার শুরু করুন',
          handleNfcTransfer,
          'wifi-outline'
        )}

        {/* Section 4: Card Management */}
        {renderAccordionItem(
          'card',
          t.cardManagementTitle,
          t.cardManagementDesc,
          t.linkNewCardButton,
          handleLinkCard,
          'card-outline'
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 20,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
