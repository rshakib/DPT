import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Spacing } from '../constants/theme';
import { LogoMark } from '../components/Logo';
import { BottomSkylineSvg } from '../components/BottomSkylineSvg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

const { width } = Dimensions.get('window');

export default function TransactionResult() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Retrieve navigation parameters passed from TransactionProcessing
  const params = useLocalSearchParams();
  const status = Array.isArray(params.status) ? params.status[0] : params.status || 'success';
  const receiverUsername = Array.isArray(params.receiverUsername) ? params.receiverUsername[0] : params.receiverUsername || 'N/A';
  const amount = Array.isArray(params.amount) ? params.amount[0] : params.amount || '0.00';
  const referenceNo = Array.isArray(params.referenceNo) ? params.referenceNo[0] : params.referenceNo || 'N/A';
  const dateTime = Array.isArray(params.dateTime) ? params.dateTime[0] : params.dateTime || 'N/A';

  const type = Array.isArray(params.type) ? params.type[0] : params.type || '';
  const mobileNumber = Array.isArray(params.mobileNumber) ? params.mobileNumber[0] : params.mobileNumber || '';
  const operator = Array.isArray(params.operator) ? params.operator[0] : params.operator || '';
  const merchantName = Array.isArray(params.merchantName) ? params.merchantName[0] : params.merchantName || '';
  const billerName = Array.isArray(params.billerName) ? params.billerName[0] : params.billerName || '';
  const billerAccountNo = Array.isArray(params.billerAccountNo) ? params.billerAccountNo[0] : params.billerAccountNo || '';

  const errorReason = Array.isArray(params.errorReason) ? params.errorReason[0] : params.errorReason || '';
  const [copied, setCopied] = useState(false);

  const isSuccess = status === 'success';

  // Map failure status codes to human-readable error reasons
  const getFailureReason = (code: string) => {
    if (errorReason) return errorReason;
    switch (code) {
      case 'insufficient_balance':
        return t.errInsufficientBalance;
      case 'hmac_mismatch':
        return t.errHmacMismatch;
      case 'receiver_not_found':
        return t.errReceiverNotFound;
      default:
        return t.errUnexpected;
    }
  };

  const handleCopyToClipboard = async () => {
    if (referenceNo === 'N/A') return;
    await Clipboard.setStringAsync(referenceNo);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleBackToHome = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/dashboard');
  };

  const handleViewHistory = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.push('/history');
  };

  const accentColor = isSuccess ? theme.success : theme.error;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Logo Mark & Wordmark */}
      <View style={[styles.logoContainer, { borderBottomColor: theme.border }]}>
        <LogoMark size={32} />
        <View style={styles.logoTextWrapper}>
          <Text style={[styles.logoText, { color: theme.text }]}>
            D<Text style={[styles.logoTextAccent, { color: theme.primary }]}>PT</Text>
          </Text>
          <Text style={[styles.logoSlogan, { color: theme.textSecondary }]}>
            Digital Pocket Transaction
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        {/* Status Circular Badges */}
        <View style={styles.statusBadgeSection}>
          <View style={styles.badgeContainer}>
            {/* Concentric ripple rings */}
            <View style={[styles.outerRipple, { backgroundColor: isSuccess ? 'rgba(9, 196, 135, 0.04)' : 'rgba(255, 56, 56, 0.04)' }]} />
            <View style={[styles.middleRipple, { backgroundColor: isSuccess ? 'rgba(9, 196, 135, 0.08)' : 'rgba(255, 56, 56, 0.08)' }]} />
            <View style={[styles.innerBadgeCircle, { backgroundColor: accentColor, shadowColor: theme.text }]}>
              <Ionicons
                name={isSuccess ? 'checkmark' : 'close'}
                size={44}
                color="#FFFFFF"
              />
            </View>

            {/* Decorative background confetti dots */}
            <View style={[styles.confettiDot, styles.dot1, { backgroundColor: accentColor }]} />
            <View style={[styles.confettiDot, styles.dot2, { backgroundColor: accentColor }]} />
            <View style={[styles.confettiDot, styles.dot3, { backgroundColor: accentColor }]} />
            <View style={[styles.confettiDot, styles.dot4, { backgroundColor: accentColor }]} />
            <View style={[styles.confettiSparkle, styles.sparkle1]}>
              <Ionicons name="sparkles" size={14} color={accentColor} />
            </View>
            <View style={[styles.confettiSparkle, styles.sparkle2]}>
              <Ionicons name="sparkles" size={12} color={accentColor} />
            </View>
          </View>

          {/* Heading Status Texts */}
          <Text style={[styles.statusTitle, { color: theme.text }]}>
            {isSuccess ? t.transferSuccessful : t.transferFailed}
          </Text>
          <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
            {isSuccess ? t.moneySentSuccess : t.couldNotCompleteTx}
          </Text>
        </View>

        {/* Failed-only Reason Card */}
        {!isSuccess && (
          <View style={[styles.reasonCard, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF5F5', borderColor: theme.error }]}>
            <Ionicons name="alert-circle" size={24} color={theme.error} style={styles.reasonIcon} />
            <View style={styles.reasonTextContainer}>
              <Text style={[styles.reasonLabel, { color: theme.error }]}>{t.reasonLabel}</Text>
              <Text style={[styles.reasonValue, { color: theme.text }]}>{getFailureReason(status)}</Text>
            </View>
          </View>
        )}

        {/* Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowColor: theme.primary }]}>
          {/* Header Row */}
          <View style={[styles.detailsHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.detailsHeaderIconWrapper, { backgroundColor: isSuccess ? (isDarkMode ? 'rgba(9,196,135,0.1)' : '#E6FFF0') : (isDarkMode ? 'rgba(255,56,56,0.1)' : '#FFF0F0') }]}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={accentColor}
              />
            </View>
            <Text style={[styles.detailsHeaderTitle, { color: theme.text }]}>{t.transactionDetailsLabel}</Text>
          </View>

          {/* Details Rows */}
          <View style={styles.detailsBody}>
            {/* Row 1: Amount */}
            <View style={styles.detailsRow}>
              <View style={styles.rowLabelContainer}>
                <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.currencySymbol, { color: theme.textSecondary }]}>৳</Text>
                </View>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Amount' : 'পরিমাণ'}</Text>
              </View>
              <Text style={[styles.rowValueAmount, { color: accentColor }]}>
                ৳ {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {type === 'mobile_recharge' ? (
              <>
                {/* Mobile Number Row */}
                <View style={styles.detailsRow}>
                  <View style={styles.rowLabelContainer}>
                    <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                      <Ionicons name="phone-portrait-outline" size={14} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{t.mobileNumberLabel || 'Mobile Number'}</Text>
                  </View>
                  <Text style={[styles.rowValueText, { color: theme.text }]}>{mobileNumber}</Text>
                </View>

                {/* Operator Row */}
                <View style={styles.detailsRow}>
                  <View style={styles.rowLabelContainer}>
                    <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                      <Ionicons name="flash-outline" size={14} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{t.selectOperatorLabel || 'Operator'}</Text>
                  </View>
                  <Text style={[styles.rowValueText, { color: theme.text }]}>{operator}</Text>
                </View>
              </>
            ) : type === 'merchant_payment' ? (
              <View style={styles.detailsRow}>
                <View style={styles.rowLabelContainer}>
                  <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name="cart-outline" size={14} color={theme.textSecondary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Merchant' : 'মার্চেন্ট'}</Text>
                </View>
                <Text style={[styles.rowValueText, { color: theme.text }]}>{merchantName || receiverUsername}</Text>
              </View>
            ) : type === 'bill_payment' ? (
              <>
                <View style={styles.detailsRow}>
                  <View style={styles.rowLabelContainer}>
                    <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                      <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Biller' : 'বিল প্রতিষ্ঠান'}</Text>
                  </View>
                  <Text style={[styles.rowValueText, { color: theme.text }]}>{billerName || receiverUsername}</Text>
                </View>
                {billerAccountNo ? (
                  <View style={styles.detailsRow}>
                    <View style={styles.rowLabelContainer}>
                      <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                        <Ionicons name="card-outline" size={14} color={theme.textSecondary} />
                      </View>
                      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Account No' : 'একাউন্ট নং'}</Text>
                    </View>
                    <Text style={[styles.rowValueText, { color: theme.text }]}>{billerAccountNo}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              /* Standard Receiver Row */
              <View style={styles.detailsRow}>
                <View style={styles.rowLabelContainer}>
                  <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{t.sentToLabel}</Text>
                </View>
                <Text style={[styles.rowValueText, { color: theme.text }]}>{receiverUsername}</Text>
              </View>
            )}

            {/* Row 3: Date & Time */}
            <View style={styles.detailsRow}>
              <View style={styles.rowLabelContainer}>
                <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                </View>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{t.dateTimeLabel}</Text>
              </View>
              <Text style={[styles.rowValueText, { color: theme.text }]}>{dateTime}</Text>
            </View>

            {/* Row 4: Reference Number */}
            <View style={[styles.detailsRow, styles.lastRow]}>
              <View style={styles.rowLabelContainer}>
                <View style={[styles.rowIconWrapper, { backgroundColor: theme.backgroundElement }]}>
                  <MaterialCommunityIcons name="pound" size={14} color={theme.textSecondary} />
                </View>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{t.transactionIdLabel}</Text>
              </View>
              <View style={styles.referenceContainer}>
                <Text style={[styles.rowValueReference, { color: theme.text }]} numberOfLines={1} ellipsizeMode="middle">
                  {referenceNo}
                </Text>
                <TouchableOpacity
                  onPress={handleCopyToClipboard}
                  style={styles.copyButton}
                  activeOpacity={0.7}
                >
                  {copied ? (
                    <View style={styles.copiedBadge}>
                      <Text style={[styles.copiedText, { color: accentColor }]}>{t.copiedFeedback}</Text>
                      <Ionicons name="checkmark-circle" size={16} color={accentColor} />
                    </View>
                  ) : (
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={accentColor}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Security / Suggestion Banners */}
        {isSuccess ? (
          <View style={[styles.infoBanner, styles.successBanner, { backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.05)' : '#F3FBF7', borderColor: isDarkMode ? 'rgba(9, 196, 135, 0.2)' : '#D6F5E3' }]}>
            <View style={[styles.bannerIconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : '#E6FFF0' }]}>
              <Ionicons name="shield-checkmark" size={18} color={theme.success} />
            </View>
            <Text style={[styles.bannerText, { color: theme.text }]}>
              {language === 'en' ? 'Your transfer is secure and encrypted end-to-end.' : 'আপনার স্থানান্তর সম্পূর্ণ নিরাপদ এবং এনক্রিপ্ট করা।'}
            </Text>
          </View>
        ) : (
          <View style={[styles.infoBanner, styles.failedBanner, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.05)' : '#FFF5F5', borderColor: isDarkMode ? 'rgba(255, 56, 56, 0.2)' : '#FFD2D2' }]}>
            <View style={[styles.bannerIconWrapper, styles.failedBannerIconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : '#FFF0F0' }]}>
              <Ionicons name="information-circle-outline" size={18} color={theme.error} />
            </View>
            <Text style={[styles.bannerText, { color: theme.text }]}>
              {language === 'en' ? 'Please check your balance and try again, or use a different payment method.' : 'অনুগ্রহ করে আপনার ব্যালেন্স চেক করে আবার চেষ্টা করুন, অথবা অন্য পেমেন্ট পদ্ধতি ব্যবহার করুন।'}
            </Text>
          </View>
        )}

        {/* Sticky Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            onPress={handleBackToHome}
            activeOpacity={0.8}
          >
            <Ionicons name="home" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>{t.backToHomeButton}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.primary, backgroundColor: theme.background }]}
            onPress={handleViewHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={20} color={theme.primary} style={styles.buttonIcon} />
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>{t.viewHistoryButton}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* City Skyline Wave Vector Illustration */}
      <BottomSkylineSvg color={accentColor} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  // Logo Header styling
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  logoTextWrapper: {
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoTextAccent: {},
  logoSlogan: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Status Badge Section
  statusBadgeSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  badgeContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Spacing.md,
  },
  outerRipple: {
    width: 130,
    height: 130,
    borderRadius: 65,
    position: 'absolute',
  },
  middleRipple: {
    width: 105,
    height: 105,
    borderRadius: 52.5,
    position: 'absolute',
  },
  innerBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    zIndex: 1,
  },
  // Confetti positions
  confettiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    opacity: 0.7,
  },
  dot1: { left: 10, top: 40 },
  dot2: { right: 15, top: 30 },
  dot3: { left: 25, bottom: 25 },
  dot4: { right: 20, bottom: 35 },
  confettiSparkle: {
    position: 'absolute',
    opacity: 0.8,
  },
  sparkle1: { right: 8, top: 58 },
  sparkle2: { left: 8, bottom: 58 },
  // Headers
  statusTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  statusSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Failed reason block
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  reasonIcon: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  reasonTextContainer: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reasonValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 1,
  },
  // Details Card
  detailsCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  detailsHeaderIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailsBody: {
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastRow: {
    alignItems: 'center',
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowValueAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  rowValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  referenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: width * 0.45,
  },
  rowValueReference: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  copyButton: {
    padding: Spacing.xs,
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Info Banners
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  successBanner: {},
  failedBanner: {},
  bannerIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedBannerIconWrapper: {},
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  // Action Buttons
  actionButtonsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  primaryButton: {
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 60,
    borderWidth: 1.5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
});
