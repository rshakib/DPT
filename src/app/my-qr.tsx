import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { BottomSkylineSvg } from '../components/BottomSkylineSvg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function MyQR() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user } = useAuth();

  const userData = user?.user || user;
  const username = userData?.username || 'shakib';

  // Clipboard copy state
  const [copied, setCopied] = useState(false);

  const handleCopyUsername = async () => {
    await Clipboard.setStringAsync(username);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleDownload = () => {
    Alert.alert(
      language === 'en' ? 'Download started' : 'ডাউনলোড শুরু হয়েছে',
      language === 'en'
        ? 'Your personal QR code is downloading to your gallery.'
        : 'আপনার ব্যক্তিগত কিউআর কোডটি গ্যালারিতে ডাউনলোড হচ্ছে।'
    );
  };

  const handleShare = () => {
    Alert.alert(
      language === 'en' ? 'Share sheet opened' : 'শেয়ার ডায়ালগ খোলা হয়েছে',
      language === 'en' ? 'DPT share dialog initiated.' : 'DPT শেয়ার চালু করা হয়েছে।'
    );
  };

  // Build JSON string payload for scanner consumption
  const qrPayload = JSON.stringify({
    app: 'dpt',
    username: username,
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Header title={t.myQr} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description Subtext */}
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {t.showQrReceiveInstantly}
        </Text>

        {/* QR Code Container Card */}
        <View style={[styles.qrCard, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowColor: theme.primary }]}>
          <View style={styles.qrCodeWrapper}>
            {/* Real SVG QR code generator */}
            <QRCode
              value={qrPayload}
              size={200}
              color="#0E0D2C"
              backgroundColor="#FFFFFF"
            />
          </View>

          {/* Account Details */}
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.yourNiroPayAccount}</Text>
          <View style={styles.accountRow}>
            <Text style={[styles.accountText, { color: theme.text }]}>@{username}</Text>
            <TouchableOpacity onPress={handleCopyUsername} style={styles.copyButton}>
              {copied ? (
                <View style={styles.copiedFeedback}>
                  <Text style={[styles.copiedText, { color: theme.primary }]}>{t.copiedFeedback}</Text>
                  <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                </View>
              ) : (
                <Ionicons name="copy-outline" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons: Download and Share */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.outlineButton, { borderColor: theme.primary, backgroundColor: theme.background }]} onPress={handleDownload} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={18} color={theme.primary} />
            <Text style={[styles.outlineButtonText, { color: theme.primary }]}>{t.downloadQrButton}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.outlineButton, { borderColor: theme.primary, backgroundColor: theme.background }]} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color={theme.primary} />
            <Text style={[styles.outlineButtonText, { color: theme.primary }]}>{t.shareQrButton}</Text>
          </TouchableOpacity>
        </View>

        {/* Info Instruction Banner */}
        <View style={[styles.infoBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.infoIconCircle, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>{t.receiveMoneyInstantly}</Text>
            <Text style={[styles.infoSubtitle, { color: theme.textSecondary }]}>
              {t.anyoneScanQrSecure}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Skyline footer illustration in brand purple color */}
      <BottomSkylineSvg color={theme.primary} />
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: Spacing.xl,
  },
  // QR Card Container
  qrCard: {
    borderWidth: 1.5,
    borderRadius: 28,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 3,
  },
  qrCodeWrapper: {
    borderWidth: 1,
    borderColor: '#E2E0EE',
    borderRadius: 20,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.lg,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  accountText: {
    fontSize: 19,
    fontWeight: '800',
  },
  copyButton: {
    padding: Spacing.xs,
  },
  copiedFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  copiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Action Buttons row
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  outlineButton: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  outlineButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Info instruction banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.md,
    gap: Spacing.md,
    width: '100%',
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
});
