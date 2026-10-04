import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { signQRPayload } from '../services/crypto';
import { generateNonce } from '../services/nfc';

export default function MyQR() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user } = useAuth();

  const userData = user?.user || user;
  const username = userData?.username || 'user';
  const displayName = userData?.full_name || userData?.name || username;

  // QR Mode: 'dynamic' (60s Rolling Anti-Clone) vs 'permanent' (Permanent Printable QR)
  const [qrMode, setQrMode] = useState<'dynamic' | 'permanent'>('dynamic');

  // Dynamic Rolling QR States
  const [timeLeft, setTimeLeft] = useState(60);
  const [qrPayload, setQrPayload] = useState<string>(
    JSON.stringify({ app: 'dpt', username })
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Permanent QR Payload (Never expires, printable, suitable for receiving payments anytime)
  const permanentPayload = JSON.stringify({
    app: 'dpt',
    version: 1,
    type: 'permanent',
    username,
    name: displayName,
  });

  // Generate fresh signed dynamic QR payload (instant, non-blocking)
  const refreshDynamicQR = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const timestamp = Date.now();
      const nonce = generateNonce();
      const baseData = `dpt:v2:${username}:${timestamp}:${nonce}`;
      const signature = await signQRPayload(baseData);

      const dynamicPayload = {
        app: 'dpt',
        version: 2,
        username,
        timestamp,
        nonce,
        sig: signature,
      };

      setQrPayload(JSON.stringify(dynamicPayload));
      setTimeLeft(60);
    } catch (e) {
      console.warn('Failed to generate signed dynamic QR:', e);
      setQrPayload(JSON.stringify({ app: 'dpt', username }));
      setTimeLeft(60);
    } finally {
      setIsRefreshing(false);
    }
  }, [username]);

  // Initial generation on mount
  useEffect(() => {
    refreshDynamicQR();
  }, [refreshDynamicQR]);

  // 60-Second countdown timer - decrements only when dynamic mode is active
  useEffect(() => {
    if (qrMode !== 'dynamic') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrMode]);

  // When timer reaches 0 in dynamic mode, trigger refresh
  useEffect(() => {
    if (qrMode === 'dynamic' && timeLeft === 0) {
      refreshDynamicQR();
    }
  }, [timeLeft, qrMode, refreshDynamicQR]);

  const handleCopyUsername = async () => {
    await Clipboard.setStringAsync(username);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const qrSvgRef = useRef<any>(null);

  const handleDownload = () => {
    if (!qrSvgRef.current) {
      Alert.alert(
        language === 'en' ? 'Not Ready' : 'প্রস্তুত নয়',
        language === 'en' ? 'QR code is generating, please try again.' : 'কিউআর কোড তৈরি হচ্ছে, অনুগ্রহ করে আবার চেষ্টা করুন।'
      );
      return;
    }

    setIsDownloading(true);
    try {
      qrSvgRef.current.toDataURL(async (base64Data: string) => {
        try {
          const filename = `niropay-qr-${username}-${qrMode}.png`;

          if (Platform.OS === 'web') {
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${base64Data}`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Alert.alert(
              language === 'en' ? 'Download Complete' : 'ডাউনলোড সম্পন্ন',
              language === 'en'
                ? `${filename} has been saved to your downloads.`
                : `${filename} ফাইলটি আপনার ডিভাইসে ডাউনলোড হয়েছে।`
            );
          } else {
            try {
              const { File, Paths } = require('expo-file-system');
              const targetFile = new File(Paths.document, filename);
              targetFile.create({ overwrite: true });
              targetFile.write(base64Data, { encoding: 'base64' });

              Alert.alert(
                language === 'en' ? 'Download Complete' : 'ডাউনলোড সম্পন্ন',
                language === 'en'
                  ? `QR code image saved successfully as ${filename} in device documents.`
                  : `কিউআর কোড ইমেজটি ${filename} নামে আপনার ডিভাইসে সংরক্ষিত হয়েছে।`
              );
            } catch (fsErr) {
              console.warn('File system write fallback:', fsErr);
              await Clipboard.setStringAsync(currentPayloadToDisplay);
              Alert.alert(
                language === 'en' ? 'QR Code Copied' : 'কিউআর কোড কপি হয়েছে',
                language === 'en'
                  ? 'QR payload copied to clipboard.'
                  : 'কিউআর কোড পেলোড ক্লিপবোর্ডে কপি করা হয়েছে।'
              );
            }
          }
        } catch (err: any) {
          Alert.alert(
            language === 'en' ? 'Download Error' : 'ডাউনলোড ব্যর্থ',
            err?.message || (language === 'en' ? 'Could not download QR code.' : 'কিউআর কোড ডাউনলোড করা সম্ভব হয়নি।')
          );
        } finally {
          setIsDownloading(false);
        }
      });
    } catch (e: any) {
      setIsDownloading(false);
      Alert.alert(
        language === 'en' ? 'Download Error' : 'ডাউনলোড সমস্যা',
        e?.message || (language === 'en' ? 'Failed to process QR code.' : 'কিউআর প্রসেস করা যায়নি।')
      );
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const modeLabel =
        qrMode === 'permanent'
          ? language === 'en'
            ? 'Permanent QR'
            : 'স্থায়ী QR'
          : language === 'en'
          ? 'Dynamic QR'
          : 'ডায়নামিক QR';

      const shareMessage =
        language === 'en'
          ? `NiroPay ${modeLabel} for @${username}\nAccount ID: @${username}\n\nScan this QR code with the NiroPay app to make an instant payment:\n${currentPayloadToDisplay}`
          : `নীরোপে ${modeLabel}: @${username}\nএকাউন্ট আইডি: @${username}\n\nটাকা পাঠাতে আপনার নীরোপে অ্যাপ দিয়ে স্ক্যান করুন:\n${currentPayloadToDisplay}`;

      await Share.share({
        title: language === 'en' ? `NiroPay QR - @${username}` : `নীরোপে কিউআর - @${username}`,
        message: shareMessage,
      });
    } catch (error: any) {
      if (
        error?.message &&
        !error.message.includes('dismissed') &&
        !error.message.includes('canceled')
      ) {
        Alert.alert(
          language === 'en' ? 'Share Error' : 'শেয়ার সমস্যা',
          error.message ||
            (language === 'en'
              ? 'Could not open share sheet.'
              : 'শেয়ার মেনু খোলা সম্ভব হয়নি।')
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

  const initialLetter = (displayName || username || 'U').charAt(0).toUpperCase();
  const currentPayloadToDisplay = qrMode === 'permanent' ? permanentPayload : qrPayload;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Header title={t.myQr || 'My QR'} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* QR Mode Switcher Segmented Control */}
        <View
          style={[
            styles.modeSwitcher,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#F2F1F8',
              borderColor: theme.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.modeTab,
              qrMode === 'dynamic' && [
                styles.modeTabActive,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ],
            ]}
            onPress={() => setQrMode('dynamic')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="shield-checkmark"
              size={15}
              color={qrMode === 'dynamic' ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.modeTabText,
                {
                  color: qrMode === 'dynamic' ? theme.primary : theme.textSecondary,
                  fontWeight: qrMode === 'dynamic' ? '700' : '600',
                },
              ]}
            >
              {language === 'en' ? 'Dynamic QR' : 'ডায়নামিক QR'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTab,
              qrMode === 'permanent' && [
                styles.modeTabActive,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ],
            ]}
            onPress={() => setQrMode('permanent')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="infinite-outline"
              size={16}
              color={qrMode === 'permanent' ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.modeTabText,
                {
                  color: qrMode === 'permanent' ? theme.primary : theme.textSecondary,
                  fontWeight: qrMode === 'permanent' ? '700' : '600',
                },
              ]}
            >
              {language === 'en' ? 'Permanent QR' : 'স্থায়ী QR'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instruction Subtitle */}
        <View style={styles.headerSubtitleContainer}>
          <Text style={[styles.subtitleText, { color: theme.textSecondary }]}>
            {qrMode === 'permanent'
              ? (language === 'en'
                  ? 'Permanent QR code. Never expires. Print or display to receive payments anytime.'
                  : 'স্থায়ী কিউআর কোড। মেয়াদ শেষ হয় না। যেকোনো সময় পেমেন্ট গ্রহণের জন্য প্রিন্ট বা প্রদর্শন করুন।')
              : (language === 'en'
                  ? 'Single-use dynamic QR. Refreshes every 1 minute with digital signature for maximum security.'
                  : 'একক ব্যবহারের ডায়নামিক QR। সর্বোচ্চ নিরাপত্তার জন্য প্রতি ১ মিনিটে ডিজিটাল স্বাক্ষর সহ পরিবর্তিত হয়।')}
          </Text>
        </View>

        {/* Main QR Card (Standard NiroPay Card) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        >
          {/* User Profile Header */}
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.primaryLight, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.primary }]}>
                {initialLetter}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>
                @{username} {qrMode === 'permanent' ? '• Permanent' : '• Dynamic'}
              </Text>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

          {/* Centered QR Code Box */}
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              <QRCode
                getRef={(ref) => {
                  qrSvgRef.current = ref;
                }}
                value={currentPayloadToDisplay}
                size={210}
                color="#0E0D2C"
                backgroundColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Badge: Dynamic 60s Countdown vs Permanent Lifetime Valid */}
          {qrMode === 'dynamic' ? (
            <View
              style={[
                styles.securityBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(255, 107, 0, 0.12)' : '#FFF4EC',
                  borderColor: isDarkMode ? 'rgba(255, 107, 0, 0.3)' : '#FFE2D1',
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={16} color={theme.primary} />
              <Text style={[styles.securityBadgeText, { color: theme.primary }]}>
                {language === 'en'
                  ? `Anti-Clone Dynamic QR (${timeLeft}s)`
                  : `ক্লোন-সুরক্ষিত ডায়নামিক QR (${timeLeft} সে.)`}
              </Text>
              <TouchableOpacity
                onPress={refreshDynamicQR}
                disabled={isRefreshing}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.refreshButton}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="refresh" size={16} color={theme.primary} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.permanentBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#E8FBF4',
                  borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#B8F4DF',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={16} color={theme.success || '#10B981'} />
              <Text style={[styles.permanentBadgeText, { color: theme.success || '#10B981' }]}>
                {language === 'en'
                  ? 'Permanent QR • Lifetime Valid'
                  : 'স্থায়ী কিউআর • আজীবন মেয়াদ'}
              </Text>
            </View>
          )}

          {/* Account Number Copy Box */}
          <View
            style={[
              styles.accountBox,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F7F6FB',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.accountBoxLeft}>
              <Text style={[styles.accountBoxLabel, { color: theme.textSecondary }]}>
                {language === 'en' ? 'ACCOUNT ID' : 'একাউন্ট আইডি'}
              </Text>
              <Text style={[styles.accountBoxValue, { color: theme.text }]} numberOfLines={1}>
                @{username}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.copyButton,
                { backgroundColor: copied ? theme.success : theme.primary },
              ]}
              onPress={handleCopyUsername}
              activeOpacity={0.8}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.copyButtonText}>
                {copied
                  ? language === 'en'
                    ? 'Copied'
                    : 'কপি হয়েছে'
                  : language === 'en'
                  ? 'Copy'
                  : 'কপি'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons: Download & Share */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
            onPress={handleDownload}
            disabled={isDownloading}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.actionIconCircle,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="download-outline" size={18} color={theme.primary} />
              )}
            </View>
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              {t.downloadQrButton || 'Download QR'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.actionIconCircle,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="share-social-outline" size={18} color={theme.primary} />
              )}
            </View>
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              {t.shareQrButton || 'Share QR'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Offline Receive Shortcut: Scan Sender's Receipt QR */}
        <TouchableOpacity
          style={[
            styles.scanSenderButton,
            {
              backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
              borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
            },
          ]}
          onPress={() => router.push('/qr-pay')}
          activeOpacity={0.8}
        >
          <View style={[styles.scanSenderIconCircle, { backgroundColor: theme.success || '#10B981' }]}>
            <Ionicons name="scan" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.scanSenderTextContainer}>
            <Text style={[styles.scanSenderTitle, { color: theme.text }]}>
              {language === 'en' ? 'Scan Sender\'s Receipt QR' : 'প্রেরকের পেমেন্ট রশিদ স্ক্যান করুন'}
            </Text>
            <Text style={[styles.scanSenderSubtitle, { color: theme.textSecondary }]}>
              {language === 'en'
                ? 'Scan the sender\'s receipt to claim (settles online)'
                : 'প্রেরকের পেমেন্ট দাবি করতে স্ক্যান করুন (অনলাইনে settle হবে)'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Security Info Card (Standard across NiroPay) */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#F9F8FD',
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.infoIconWrapper, { backgroundColor: theme.primaryLight }]}>
            <Ionicons
              name={qrMode === 'permanent' ? 'infinite-outline' : 'shield-checkmark-outline'}
              size={20}
              color={theme.primary}
            />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>
              {qrMode === 'permanent'
                ? (language === 'en' ? 'Permanent QR Code' : 'স্থায়ী কিউআর কোড')
                : (language === 'en' ? 'Clone-Proof Protection' : 'ক্লোন-সুরক্ষিত নিরাপত্তা')}
            </Text>
            <Text style={[styles.infoDesc, { color: theme.textSecondary }]}>
              {qrMode === 'permanent'
                ? (language === 'en'
                    ? 'This QR code never expires. Print or share it to receive payments anytime. All payments sent here are credited immediately.'
                    : 'এই কিউআর কোডের মেয়াদ কখনোই শেষ হবে না। এটি প্রিন্ট বা শেয়ার করে রাখুন। যে কেউ স্ক্যান করে সরাসরি পেমেন্ট করতে পারবে।')
                : (language === 'en'
                    ? 'This QR code auto-refreshes every 1 minute with a cryptographic digital signature. Screenshots cannot be reused or cloned.'
                    : 'এই কিউআর কোডটি ডিজিটাল স্বাক্ষর সহ প্রতি ১ মিনিটে স্বয়ংক্রিয়ভাবে পরিবর্তিত হয়। স্ক্রিনশট বা ছবি নকল করে ব্যবহার করা যাবে না।')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl,
  },
  modeSwitcher: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  modeTabActive: {
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
  },
  permanentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 6,
  },
  permanentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitleContainer: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  subtitleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.md,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileHandle: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardDivider: {
    width: '100%',
    height: 1,
    marginBottom: Spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  qrWrapper: {
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEBF0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 8,
  },
  securityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  refreshButton: {
    padding: 2,
  },
  accountBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  accountBoxLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  accountBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  accountBoxValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 5,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 8,
    elevation: 1,
  },
  actionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    gap: Spacing.md,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  scanSenderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  scanSenderIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  scanSenderTextContainer: {
    flex: 1,
  },
  scanSenderTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  scanSenderSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
