import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';
import { verifyQRPayload, parseEnvelopeP } from '../services/crypto';
import { syncService } from '../services/sync';

export default function QRPay() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user, updateUser } = useAuth();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Scanner status
  const [scanned, setScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Toggle between scanner viewfinder vs manual text entry mode
  const [isManualMode, setIsManualMode] = useState(false);

  // Manual Form States
  const [manualReceiver, setManualReceiver] = useState('');
  const [isManualValidating, setIsManualValidating] = useState(false);
  const [manualValidationError, setManualValidationError] = useState<string | null>(null);
  const [verifiedManualReceiver, setVerifiedManualReceiver] = useState<string | null>(null);

  // Keyboard active states
  const [focusedField, setFocusedField] = useState<'id' | null>(null);

  const manualReceiverRef = useRef<TextInput>(null);

  // Request camera permission on mount if not granted
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isScanning) return;
    setScanned(true);
    setIsScanning(true);

    try {
      const parsed = JSON.parse(data);

      // =========================================================================
      // 2-WAY OFFLINE HANDSHAKE: RECEIVER SCANS THE SENDER'S SIGNED ENVELOPE P
      // The receiver relays the SAME immutable envelope to POST /transfer/claim;
      // the server verifies the sender's signature and settles (receiver-authoritative).
      // =========================================================================
      const incomingEnvelope = parseEnvelopeP(data);
      if (incomingEnvelope) {
        const envSender = String(incomingEnvelope.AAD?.S || '').trim().toLowerCase();
        const envTxid = String(incomingEnvelope.AAD?.TxID || '');

        // Receiver identity is enforced server-side after decryption (R is not in AAD).

        // 2. Local replay guard (server-side TxID idempotency is authoritative)
        if (envTxid && (await db.isQrNonceUsed(envTxid))) {
          Alert.alert(
            language === 'en' ? 'Already Claimed' : 'ইতিমধ্যে গ্রহণ করা হয়েছে',
            language === 'en'
              ? 'This payment has already been claimed and cannot be claimed again.'
              : 'এই পেমেন্টটি ইতিমধ্যে গ্রহণ করা হয়েছে এবং পুনরায় গ্রহণ করা যাবে না।',
            [{ text: 'OK', onPress: () => { setScanned(false); setIsScanning(false); } }]
          );
          return;
        }

        // 3. Receiver-authoritative settlement: relay the envelope to the server.
        const claimRes = await api.claimTransfer(incomingEnvelope);
        if (claimRes.success) {
          await db.markQrNonceUsed(envTxid, envSender, user!.username);
          const creditedBalance = claimRes.data?.receiver_balance;
          if (user && creditedBalance !== undefined) {
            await updateUser({ ...user, balance: creditedBalance });
            try {
              await db.saveCachedUser(user.username, { ...user, balance: creditedBalance });
            } catch (_) {}
          }
          syncService.notifyDataChanged();
          syncService.forceSync(user!.username);
          Alert.alert(
            language === 'en' ? 'Money Received!' : 'টাকা গ্রহণ সফল!',
            language === 'en'
              ? `Payment claimed successfully from @${envSender}.`
              : `@${envSender} থেকে পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে।`,
            [{ text: language === 'en' ? 'View Dashboard' : 'ড্যাশবোর্ড দেখুন', onPress: () => router.replace('/dashboard') }]
          );
          return;
        }

        // 4. Offline / network error -> queue the SAME envelope for deferred claim.
        const claimErr = (claimRes.message || '').toLowerCase();
        const isNetErr = claimErr.includes('network') || claimErr.includes('fetch') || claimErr.includes('connection failed');
        if (isNetErr && envTxid) {
          await db.markQrNonceUsed(envTxid, envSender, user!.username);
          await db.savePendingOfflineTransaction(
            user!.username,
            envSender,
            0,
            'claim',
            envTxid,
            { envelope: incomingEnvelope }
          );
          syncService.notifyDataChanged();
          Alert.alert(
            language === 'en' ? 'Queued for Claim' : 'দাবি কিউতে রাখা হয়েছে',
            language === 'en'
              ? 'You are offline. This payment will be claimed automatically when you reconnect.'
              : 'আপনি অফলাইনে আছেন। ইন্টারনেট ফিরলে এই পেমেন্ট স্বয়ংক্রিয়ভাবে দাবি করা হবে।',
            [{ text: 'OK', onPress: () => router.replace('/dashboard') }]
          );
          return;
        }

        Alert.alert(
          language === 'en' ? 'Claim Failed' : 'দাবি ব্যর্থ',
          claimRes.message || (language === 'en' ? 'This payment could not be claimed.' : 'এই পেমেন্ট দাবি করা যায়নি।'),
          [{ text: 'OK', onPress: () => { setScanned(false); setIsScanning(false); } }]
        );
        return;
      }

      if (parsed.app === 'dpt' && parsed.username) {
        const username = parsed.username.trim().toLowerCase();

        // Dynamic QR (Version 2): Verify signature, timestamp TTL, and burn nonce
        if (parsed.version === 2 && parsed.sig && parsed.nonce && parsed.timestamp) {
          const now = Date.now();
          const ageMs = now - Number(parsed.timestamp);

          // 1. Check TTL Expiration (90s window to tolerate clock skew)
          if (ageMs > 90000 || ageMs < -30000) {
            Alert.alert(
              language === 'en' ? 'QR Code Expired' : 'কিউআর কোডের মেয়াদ শেষ',
              language === 'en'
                ? 'This dynamic QR code has expired. Please ask the recipient to refresh their screen.'
                : 'এই ডায়নামিক কিউআর কোডটির মেয়াদ শেষ হয়েছে। অনুগ্রহ করে প্রাপককে তার স্ক্রিন রিফ্রেশ করতে বলুন।',
              [{ text: 'OK', onPress: () => setScanned(false) }]
            );
            return;
          }

          // 2. Replay check (nonce burn)
          const isReplayed = await db.isQrNonceUsed(parsed.nonce);
          if (isReplayed) {
            Alert.alert(
              language === 'en' ? 'QR Already Used' : 'কিউআর কোডটি ইতিমধ্যে ব্যবহৃত',
              language === 'en'
                ? 'This QR code has already been scanned and cannot be reused.'
                : 'এই কিউআর কোডটি ইতিমধ্যে স্ক্যান করা হয়েছে এবং পুনরায় ব্যবহার করা যাবে না।',
              [{ text: 'OK', onPress: () => setScanned(false) }]
            );
            return;
          }

          // 3. Cryptographic Signature verification
          const baseData = `dpt:v2:${parsed.username}:${parsed.timestamp}:${parsed.nonce}`;
          const isSigValid = await verifyQRPayload(baseData, parsed.sig);
          if (!isSigValid) {
            Alert.alert(
              language === 'en' ? 'Security Alert' : 'নিরাপত্তা সতর্কতা',
              language === 'en'
                ? 'Cryptographic signature verification failed. This QR code may be counterfeit or modified.'
                : 'ডিজিটাল স্বাক্ষর যাচাই ব্যর্থ হয়েছে। এই কিউআর কোডটি জাল বা পরিবর্তিত হতে পারে।',
              [{ text: 'OK', onPress: () => setScanned(false) }]
            );
            return;
          }

          // Burn nonce immediately
          await db.markQrNonceUsed(parsed.nonce, user?.username || 'unknown', username);
        }

        const merchantDisplayName = parsed.name || parsed.merchantName || username;

        // Check receiver account existence
        const result = await api.checkReceiver(username);
        if (result.success) {
          router.replace({
            pathname: '/qr-amount',
            params: {
              merchantName: merchantDisplayName,
              merchantHandle: `@${username}`,
            },
          });
        } else {
          const errorMsg = (result.message || '').toLowerCase();
          const isNetworkError = errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection failed');
          if (isNetworkError) {
            // Offline: allow proceeding optimistically (transfer will be queued at execution)
            router.replace({
              pathname: '/qr-amount',
              params: {
                merchantName: merchantDisplayName,
                merchantHandle: `@${username}`,
              },
            });
          } else {
            Alert.alert(
              language === 'en' ? 'Receiver Not Found' : 'গ্রাহক পাওয়া যায়নি',
              result.message || (language === 'en' ? 'User does not exist in DPT.' : 'DPT-তে ব্যবহারকারী খুঁজে পাওয়া যায়নি।'),
              [{ text: 'OK', onPress: () => setScanned(false) }]
            );
          }
        }
      } else {
        Alert.alert(
          language === 'en' ? 'Invalid QR Code' : 'অকার্যকর কিউআর কোড',
          language === 'en' ? 'This QR code was not generated by DPT.' : 'এই কিউআর কোডটি DPT দ্বারা তৈরি নয়।',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    } catch (e) {
      Alert.alert(
        language === 'en' ? 'Invalid QR' : 'অকার্যকর কিউআর',
        language === 'en' ? 'Could not decode QR code data.' : 'কিউআর কোড ডাটা ডিকোড করা যায়নি।',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualReceiverChange = (text: string) => {
    const allowed = text.replace(/[^a-zA-Z0-9_]/g, '');
    setManualReceiver(allowed);
    setVerifiedManualReceiver(null);
    setManualValidationError(null);
  };

  const handleVerifyManualReceiver = async () => {
    if (!manualReceiver.trim()) return;

    setIsManualValidating(true);
    setManualValidationError(null);
    setVerifiedManualReceiver(null);

    const cleaned = manualReceiver.trim().toLowerCase();

    // client-side self-transaction check
    if (cleaned === user?.username?.toLowerCase()) {
      setIsManualValidating(false);
      setManualValidationError(t.selfTxNotAllowed);
      return;
    }

    // NOTE: currently treats all QR-identified users as personal accounts. Once backend exposes account_type via /check-receiver, branch here to route merchant/biller accounts to a dedicated merchant-payment confirmation flow instead.
    const result = await api.checkReceiver(cleaned);
    setIsManualValidating(false);

    if (result.success) {
      setVerifiedManualReceiver(`@${cleaned}`);
      setTimeout(() => {
        router.push({
          pathname: '/qr-amount',
          params: {
            merchantName: cleaned,
            merchantHandle: `@${cleaned}`,
          },
        });
      }, 500);
    } else {
      const errorMsg = (result.message || '').toLowerCase();
      const isNetworkError = errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection failed');
      if (isNetworkError) {
        // Offline: allow proceeding optimistically (transfer will be queued at execution)
        setVerifiedManualReceiver(`@${cleaned}`);
        setTimeout(() => {
          router.push({
            pathname: '/qr-amount',
            params: {
              merchantName: cleaned,
              merchantHandle: `@${cleaned}`,
            },
          });
        }, 500);
      } else {
        setManualValidationError(result.message || t.receiverNotFoundMsg);
      }
    }
  };

  // Render camera loading/unauthorized overlays
  if (!permission) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title={t.qrPay} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title={t.qrPay} />
        <View style={styles.centerContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.textSecondary} style={{ marginBottom: Spacing.md }} />
          <Text style={[styles.permissionText, { color: theme.text }]}>
            {language === 'en' ? 'We need camera permission to scan QR codes' : 'কিউআর কোড স্ক্যান করতে ক্যামেরা অ্যাক্সেস প্রয়োজন'}
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>
              {language === 'en' ? 'Grant Permission' : 'অনুমতি দিন'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        >
          {isScanning ? (
            <View style={styles.scanningOverlay}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.scanningText, { color: theme.text }]}>{t.decodingQrCode}</Text>
            </View>
          ) : !isManualMode ? (
            <View style={styles.scannerContainer}>
              <Text style={[styles.scannerPrompt, { color: theme.textSecondary }]}>{t.alignQrFrame}</Text>

              {/* Viewfinder containing CameraView */}
              <View style={[styles.viewfinder, { shadowColor: theme.primary }]}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                />
                <View style={[styles.bracket, styles.bracketTopLeft]} />
                <View style={[styles.bracket, styles.bracketTopRight]} />
                <View style={[styles.bracket, styles.bracketBottomLeft]} />
                <View style={[styles.bracket, styles.bracketBottomRight]} />
                <View style={[styles.laserLine, { backgroundColor: theme.primary, shadowColor: theme.primary }]} />
              </View>

              <View style={styles.scannerButtonsRow}>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setIsManualMode(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.linkButtonText, { color: theme.primary }]}>{t.enterCodeButton}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* MANUAL PAY BY CODE VIEW */
            <View style={styles.manualContainer}>
              <Text style={[styles.manualPrompt, { color: theme.text }]}>{t.payEnteringDetails}</Text>

              <View style={styles.formGroup}>
                {/* Field 1: Receiver's Username */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>{t.receiverUsernameLabel}</Text>
                  <Pressable
                    onPress={() => manualReceiverRef.current?.focus()}
                    style={[
                      styles.inputWrapper,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      focusedField === 'id' && [styles.inputWrapperFocused, { borderColor: theme.primary, backgroundColor: theme.background, shadowColor: theme.primary }],
                      manualValidationError && { borderColor: theme.error, backgroundColor: isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF9F9' },
                      verifiedManualReceiver && { borderColor: theme.success, backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#F5FFF9' },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={
                        manualValidationError
                          ? theme.error
                          : verifiedManualReceiver
                          ? theme.success
                          : focusedField === 'id'
                          ? theme.primary
                          : theme.textSecondary
                      }
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={manualReceiverRef}
                      style={[styles.input, { color: theme.text }]}
                      placeholder={t.usernamePlaceholder}
                      placeholderTextColor={isDarkMode ? '#7E7C9D' : '#A5A3C1'}
                      value={manualReceiver}
                      onChangeText={handleManualReceiverChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedField('id')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </Pressable>

                  {/* Live Manual Status Messages */}
                  {isManualValidating && (
                    <View style={styles.feedbackRow}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.feedbackChecking, { color: theme.textSecondary }]}>{t.checkingUsername}</Text>
                    </View>
                  )}
                  {verifiedManualReceiver && (
                    <View style={styles.feedbackRow}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                      <Text style={[styles.feedbackSuccess, { color: theme.success }]}>{t.receiverVerifiedMsg}: {verifiedManualReceiver}</Text>
                    </View>
                  )}
                  {manualValidationError && (
                    <View style={styles.feedbackRow}>
                      <Ionicons name="alert-circle" size={16} color={theme.error} />
                      <Text style={[styles.feedbackError, { color: theme.error }]}>{manualValidationError}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Action buttons */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: theme.primary, shadowColor: theme.primary },
                  (!manualReceiver.trim() || isManualValidating) && [styles.confirmButtonDisabled, { backgroundColor: isDarkMode ? '#2A2A2A' : '#C6C5DB' }],
                ]}
                disabled={!manualReceiver.trim() || isManualValidating}
                onPress={handleVerifyManualReceiver}
                activeOpacity={0.8}
              >
                {isManualValidating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.confirmButtonText}>Verify & Continue</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.returnScanButton}
                onPress={() => setIsManualMode(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="scan-outline" size={18} color={theme.primary} />
                <Text style={[styles.returnScanText, { color: theme.primary }]}>{t.payByQrInstead}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
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
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  permissionText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: Spacing.md,
    lineHeight: 22,
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scanningOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    minHeight: 300,
  },
  scanningText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scannerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  scannerPrompt: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewfinder: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(14, 13, 44, 0.85)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 3,
  },
  bracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
  },
  bracketTopLeft: {
    top: 15,
    left: 15,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 12,
  },
  bracketTopRight: {
    top: 15,
    right: 15,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 12,
  },
  bracketBottomLeft: {
    bottom: 15,
    left: 15,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bracketBottomRight: {
    bottom: 15,
    right: 15,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 12,
  },
  laserLine: {
    position: 'absolute',
    top: '48%',
    left: '10%',
    right: '10%',
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 1,
  },
  scannerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xl,
  },
  linkButton: {
    paddingVertical: 10,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  manualContainer: {
    flex: 1,
    gap: Spacing.xl,
  },
  manualPrompt: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  formGroup: {
    gap: Spacing.md,
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
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
  },
  confirmButton: {
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginTop: Spacing.md,
  },
  confirmButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
  returnScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 12,
  },
  returnScanText: {
    fontSize: 14,
    fontWeight: '700',
  },
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
}) as any;
