import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

const { width } = Dimensions.get('window');

export default function TransactionResult() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

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
  const offlineReceipt = Array.isArray(params.offlineReceipt) ? params.offlineReceipt[0] : params.offlineReceipt || '';
  const [copied, setCopied] = useState(false);

  // Offline receipt QR is single-use and expires 60s after it is shown.
  const [receiptSecondsLeft, setReceiptSecondsLeft] = useState(60);
  useEffect(() => {
    if (!offlineReceipt) return;
    setReceiptSecondsLeft(60);
    const timer = setInterval(() => {
      setReceiptSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [offlineReceipt]);

  const isSuccess = status === 'success';
  const isPending = status === 'pending' || status === 'queued_offline' || status === 'submitted';

  const getFailureReason = (code: string) => {
    if (errorReason) return errorReason;
    if (code === 'failed_unrefunded' || code === 'forfeited_no_refund') {
      return language === 'en'
        ? 'Transaction failed after 5 retry attempts. Funds debited permanently and bank notified.'
        : '৫ বার চেষ্টার পরও লেনদেন সম্পন্ন হয়নি। নিয়ম অনুযায়ী টাকা কর্তন করা হয়েছে এবং ব্যাংককে অবহিত করা হয়েছে।';
    }
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
    setTimeout(() => setCopied(false), 2000);
  };

  const navigation = useNavigation();

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

  const gradientColors = (isSuccess || isPending)
    ? (theme.gradient as readonly [string, string, ...string[]])
    : ([theme.error, '#FF6B6B'] as readonly [string, string]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Header */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Decorative circle */}
        <View style={styles.headerDecorCircle} />

        {/* Status Icon */}
        <View style={styles.statusIconWrapper}>
          <View style={styles.statusIconInner}>
            <Ionicons
              name={isSuccess ? 'checkmark' : isPending ? 'time' : 'close'}
              size={40}
              color="#FFFFFF"
            />
          </View>
        </View>

        {/* Status Text */}
        <Text style={styles.statusTitle}>
          {isPending
            ? (language === 'en' ? 'Submitted (Pending)' : 'জমা হয়েছে (অপেক্ষমাণ)')
            : isSuccess
            ? t.transferSuccessful
            : (status === 'failed_unrefunded' || status === 'forfeited_no_refund'
                ? (language === 'en' ? 'Transfer Failed (Non-Refundable)' : 'লেনদেন ব্যর্থ (অফেরতযোগ্য)')
                : t.transferFailed)}
        </Text>
        <Text style={styles.statusSubtitle}>
          {isPending
            ? (language === 'en'
                ? 'Queued offline. It will be settled once you are back online.'
                : 'অফলাইনে জমা হয়েছে। ইন্টারনেট ফিরলে নিষ্পত্তি হবে।')
            : isSuccess
            ? t.moneySentSuccess
            : (status === 'failed_unrefunded' || status === 'forfeited_no_refund'
                ? (language === 'en'
                    ? '5 retries failed. Funds debited & bank notified.'
                    : '৫ বার চেষ্টার পরও ব্যর্থ। টাকা কর্তন করা হয়েছে ও ব্যাংককে অবহিত করা হয়েছে।')
                : t.couldNotCompleteTx)}
        </Text>

        {/* Amount */}
        <Text style={styles.amountDisplay}>
          ৳ {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Failed Reason Card */}
        {!isSuccess && !isPending && (
          <View style={[styles.reasonCard, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.08)' : '#FFF5F5', borderColor: isDarkMode ? 'rgba(255, 56, 56, 0.2)' : '#FFD2D2' }]}>
            <View style={[styles.reasonIconCircle, { backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.15)' : '#FFE8E8' }]}>
              <Ionicons name="alert-circle" size={20} color={theme.error} />
            </View>
            <View style={styles.reasonTextContainer}>
              <Text style={[styles.reasonLabel, { color: theme.error }]}>{t.reasonLabel}</Text>
              <Text style={[styles.reasonValue, { color: theme.text }]}>{getFailureReason(status)}</Text>
            </View>
          </View>
        )}

        {/* Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {/* Amount Row */}
          <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
            <View style={styles.detailLeft}>
              <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                <Text style={[styles.detailCurrency, { color: theme.textSecondary }]}>৳</Text>
              </View>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Amount' : 'পরিমাণ'}</Text>
            </View>
            <Text style={[styles.detailValueAmount, { color: isSuccess ? theme.success : isPending ? theme.text : theme.error }]}>
              ৳ {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {/* Type-specific rows */}
          {type === 'mobile_recharge' ? (
            <>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                    <Ionicons name="phone-portrait-outline" size={14} color={theme.textSecondary} />
                  </View>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{t.mobileNumberLabel || 'Mobile'}</Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.text }]}>{mobileNumber}</Text>
              </View>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                    <Ionicons name="flash-outline" size={14} color={theme.textSecondary} />
                  </View>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{t.selectOperatorLabel || 'Operator'}</Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.text }]}>{operator}</Text>
              </View>
            </>
          ) : type === 'merchant_payment' ? (
            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <View style={styles.detailLeft}>
                <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                  <Ionicons name="storefront-outline" size={14} color={theme.textSecondary} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Merchant' : 'মার্চেন্ট'}</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.text }]}>{merchantName || receiverUsername}</Text>
            </View>
          ) : type === 'bill_payment' ? (
            <>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                    <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
                  </View>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Biller' : 'বিল প্রতিষ্ঠান'}</Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.text }]}>{billerName || receiverUsername}</Text>
              </View>
              {billerAccountNo ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.detailLeft}>
                    <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                      <Ionicons name="card-outline" size={14} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Account' : 'একাউন্ট'}</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{billerAccountNo}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <View style={styles.detailLeft}>
                <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                  <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{t.sentToLabel}</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.text }]}>{receiverUsername}</Text>
            </View>
          )}

          {/* Date & Time */}
          <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
            <View style={styles.detailLeft}>
              <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
              </View>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{t.dateTimeLabel}</Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.text }]}>{dateTime}</Text>
          </View>

          {/* Reference */}
          <View style={[styles.detailRow, styles.lastRow]}>
            <View style={styles.detailLeft}>
              <View style={[styles.detailIconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F3F8' }]}>
                <MaterialCommunityIcons name="pound" size={14} color={theme.textSecondary} />
              </View>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{t.transactionIdLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={handleCopyToClipboard}
              style={styles.copyRow}
              activeOpacity={0.7}
            >
              <Text style={[styles.detailValueRef, { color: theme.text }]} numberOfLines={1} ellipsizeMode="middle">
                {referenceNo}
              </Text>
              {copied ? (
                <View style={styles.copiedBadge}>
                  <Text style={[styles.copiedText, { color: isSuccess ? theme.success : theme.error }]}>{t.copiedFeedback}</Text>
                </View>
              ) : (
                <Ionicons name="copy-outline" size={16} color={isSuccess ? theme.success : theme.error} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Instant Offline Receiver Settlement Card — single-use QR, expires in 60s */}
        {(isSuccess || isPending) && Boolean(offlineReceipt) && (
          <View style={[styles.offlineCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.offlineCardHeader}>
              <Ionicons name="qr-code" size={20} color={theme.primary} />
              <Text style={[styles.offlineCardTitle, { color: theme.text }]}>
                {language === 'en' ? 'Offline Receiver Claim' : 'প্রাপকের অফলাইন দাবি'}
              </Text>
            </View>
            {receiptSecondsLeft <= 0 ? (
              <View style={styles.receiptExpired}>
                <Ionicons name="timer-outline" size={44} color={theme.error} />
                <Text style={[styles.receiptExpiredText, { color: theme.error }]}>
                  {language === 'en' ? 'This QR has expired (1-minute limit).' : 'এই কিউআরটির সময় শেষ (১ মিনিট সীমা)।'}
                </Text>
                <Text style={[styles.offlineCardSubtitle, { color: theme.textSecondary }]}>
                  {language === 'en' ? 'Start the payment again to get a fresh QR.' : 'নতুন কিউআর পেতে আবার পেমেন্ট শুরু করুন।'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.offlineCardSubtitle, { color: theme.textSecondary }]}>
                  {language === 'en'
                    ? `Ask @${receiverUsername} to scan this QR to claim ৳${amount}. It settles server-side once the payee is online.`
                    : `প্রাপক @${receiverUsername}-কে এই কিউআর স্ক্যান করতে বলুন। প্রাপক অনলাইনে এলে দাবিটি সার্ভারে settle হবে।`}
                </Text>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={offlineReceipt}
                    size={260}
                    ecl="L"
                    color={theme.textDark || '#000000'}
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={[styles.receiptTimer, { color: theme.primary }]}>
                  {language === 'en' ? `Valid for ${receiptSecondsLeft}s · single use` : `${receiptSecondsLeft} সেকেন্ড · একবার ব্যবহারযোগ্য`}
                </Text>
              </>
            )}
            <View style={styles.offlineBadge}>
              <Ionicons name="shield-checkmark" size={14} color={theme.success} />
              <Text style={[styles.offlineBadgeText, { color: theme.success }]}>
                {language === 'en' ? 'Single-Use Cryptographically Signed' : 'এককালীন ব্যবহারযোগ্য ডিজিটালভাবে স্বাক্ষরিত'}
              </Text>
            </View>
          </View>
        )}

        {/* Security Banner */}
        <View style={[styles.securityBanner, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8F7FF', borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark" size={16} color={theme.primary} />
          <Text style={[styles.securityText, { color: theme.textSecondary }]}>
            {language === 'en' ? 'End-to-end encrypted transaction' : 'এন্ড-টু-এন্ড এনক্রিপ্টেড লেনদেন'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleBackToHome}
            activeOpacity={0.8}
          >
            <Ionicons name="home" size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.primaryButtonText}>{t.backToHomeButton}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
            onPress={handleViewHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={20} color={theme.textSecondary} style={styles.btnIcon} />
            <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>{t.viewHistoryButton}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // Gradient Header
  gradientHeader: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecorCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  statusIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.lg,
  },
  amountDisplay: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: Spacing.lg,
  },
  // Scroll Content
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  // Failed Reason
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  reasonIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonTextContainer: {
    flex: 1,
    gap: 2,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  // Details Card
  detailsCard: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  detailIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCurrency: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  detailValueAmount: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  detailValueRef: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginRight: Spacing.xs,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Security Banner
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Actions
  actionsContainer: {
    gap: Spacing.sm,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnIcon: {
    marginRight: Spacing.sm,
  },
  offlineCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  offlineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  offlineCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  offlineCardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  qrWrapper: {
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: Spacing.md,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  receiptTimer: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  receiptExpired: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  receiptExpiredText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
