import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  isNFCAvailable,
  stopNFC,
  writeTransferNDEF,
  readTransferNDEF,
  generateNFCTransferId,
  generateNonce,
  NFCTransferPayload,
} from '../services/nfc';
import * as db from '../services/db';
import { syncService } from '../services/sync';

const { width } = Dimensions.get('window');

type NFCStep = 'choose' | 'waiting-tap' | 'success' | 'error';

export default function NFCTransfer() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState<NFCStep>('choose');
  const [mode, setMode] = useState<'send' | 'receive' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<NFCTransferPayload | null>(null);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkNFC();
    return () => { stopNFC(); };
  }, []);

  useEffect(() => {
    if (step === 'waiting-tap') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [step]);

  const checkNFC = async () => {
    const available = await isNFCAvailable();
    setNfcAvailable(available);
  };

  // SEND: navigate to normal send-money screen
  const handleSendPress = () => {
    router.push('/send-money');
  };

  // RECEIVE: wait for sender to tap
  const handleReceivePress = () => {
    setMode('receive');
    setStep('waiting-tap');
    startReceiver();
  };

  const startReceiver = async () => {
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const senderPayload = await readTransferNDEF();

      if (senderPayload && senderPayload.type === 'DPT_P2P_TRANSFER') {
        // Write confirmation back to sender
        const confirmPayload: NFCTransferPayload = {
          type: 'DPT_P2P_TRANSFER',
          version: 1,
          sender: user!.username,
          receiver: senderPayload.sender,
          amount: senderPayload.amount,
          timestamp: new Date().toISOString(),
          txid: senderPayload.txid,
          nonce: generateNonce(),
        };
        await writeTransferNDEF(confirmPayload);

        // Save received transaction locally
        const tx = {
          id: senderPayload.txid,
          sender_username: senderPayload.sender,
          receiver_username: user!.username,
          amount: senderPayload.amount,
          type: 'nfc_transfer',
          status: 'success',
          reference: senderPayload.txid,
          created_at: senderPayload.timestamp,
        };
        await db.mergeCachedTransactions(user!.username, [tx]);

        // Update balance
        const newBalance = (user!.balance || 0) + senderPayload.amount;
        await updateUser({ ...user!, balance: newBalance });
        await db.saveCachedUser(user!.username, { ...user, balance: newBalance });

        syncService.notifyDataChanged();
        syncService.forceSync(user!.username);

        setSuccessData(senderPayload);
        setStep('success');

        Alert.alert(
          language === 'en' ? 'Money Received!' : 'টাকা পেয়েছেন!',
          language === 'en'
            ? `৳${senderPayload.amount} received from @${senderPayload.sender}`
            : `৳${senderPayload.amount} @${senderPayload.sender}-এর কাছ থেকে পেয়েছেন`
        );
      } else {
        throw new Error('No valid transfer data received');
      }
    } catch (e: any) {
      setErrorMessage(e.message || (language === 'en' ? 'Receive failed' : 'গ্রহণ ব্যর্থ'));
      setStep('error');
    } finally {
      setIsProcessing(false);
      await stopNFC();
    }
  };

  const handleRetry = () => {
    setStep('choose');
    setMode(null);
    setErrorMessage('');
    setSuccessData(null);
  };

  const handleDone = () => {
    stopNFC();
    router.push('/dashboard');
  };

  // --- NFC NOT AVAILABLE ---
  if (nfcAvailable === false) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title="NFC Transfer" />
        <View style={styles.centerContent}>
          <Ionicons name="wifi-outline" size={80} color={theme.textSecondary} />
          <Text style={[styles.title, { color: theme.text, marginTop: 20 }]}>
            {language === 'en' ? 'NFC Not Available' : 'NFC পাওয়া যাচ্ছে না'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'en'
              ? 'This device does not support NFC or NFC is disabled in settings.'
              : 'এই ডিভাইসে NFC সাপোর্ট করে না বা সেটিংসে NFC বন্ধ আছে।'}
          </Text>
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.primary, marginTop: 30 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.mainButtonText}>{language === 'en' ? 'Go Back' : 'ফিরে যান'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="NFC Transfer" />

      {/* STEP 1: Choose Send or Receive */}
      {step === 'choose' && (
        <View style={styles.chooseContainer}>
          <View style={styles.nfcIconContainer}>
            <Ionicons name="wifi" size={48} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            {language === 'en' ? 'NFC Transfer' : 'NFC ট্রান্সফার'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'en'
              ? 'Send or receive money by tapping phones together'
              : 'ফোন একসাথে ট্যাপ করে টাকা পাঠান বা গ্রহণ করুন'}
          </Text>

          <View style={styles.optionsContainer}>
            {/* Send Option */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={handleSendPress}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="arrow-up" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                {language === 'en' ? 'Send Money' : 'টাকা পাঠান'}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                {language === 'en'
                  ? 'Open send money form'
                  : 'টাকা পাঠানোর ফর্ম খুলুন'}
              </Text>
            </TouchableOpacity>

            {/* Receive Option */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={handleReceivePress}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIcon, { backgroundColor: theme.success }]}>
                <Ionicons name="arrow-down" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                {language === 'en' ? 'Receive Money' : 'টাকা গ্রহণ করুন'}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                {language === 'en'
                  ? 'Wait for sender to tap'
                  : 'প্রেরকের ট্যাপের জন্য অপেক্ষা করুন'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 2: Waiting for Tap (Receive mode) */}
      {step === 'waiting-tap' && (
        <View style={styles.waitingContainer}>
          <Animated.View
            style={[
              styles.nfcCircle,
              { borderColor: theme.success, transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Ionicons name="wifi" size={56} color={theme.success} />
          </Animated.View>

          <Text style={[styles.title, { color: theme.text, marginTop: 28 }]}>
            {language === 'en' ? 'Waiting for Sender...' : 'প্রেরকের জন্য অপেক্ষা করছে...'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'en'
              ? 'Hold your phone near the sender\'s phone'
              : 'প্রেরকের ফোনের কাছে আপনার ফোন ধরুন'}
          </Text>

          {isProcessing && (
            <ActivityIndicator size="large" color={theme.success} style={{ marginTop: 20 }} />
          )}

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.border, marginTop: 30 }]}
            onPress={() => { stopNFC(); handleRetry(); }}
          >
            <Text style={[styles.mainButtonText, { color: theme.text }]}>
              {language === 'en' ? 'Cancel' : 'বাতিল'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3: Success (Receive mode) */}
      {step === 'success' && successData && (
        <View style={styles.successContainer}>
          <View style={[styles.successBadge, { backgroundColor: theme.success }]}>
            <Ionicons name="checkmark" size={48} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, { color: theme.text, marginTop: 20 }]}>
            {language === 'en' ? 'Money Received!' : 'টাকা পেয়েছেন!'}
          </Text>

          <Text style={[styles.amountText, { color: theme.success }]}>
            + ৳{successData.amount}
          </Text>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'en'
              ? `From @${successData.sender}`
              : `@${successData.sender}-এর কাছ থেকে`}
          </Text>

          <Text style={[styles.refText, { color: theme.textSecondary }]}>
            Ref: {successData.txid}
          </Text>

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.success, marginTop: 30 }]}
            onPress={handleDone}
          >
            <Text style={styles.mainButtonText}>
              {language === 'en' ? 'Done' : 'সম্পন্ন'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ERROR */}
      {step === 'error' && (
        <View style={styles.errorContainer}>
          <Ionicons name="close-circle" size={72} color={theme.error} />

          <Text style={[styles.title, { color: theme.text, marginTop: 20 }]}>
            {language === 'en' ? 'Transfer Failed' : 'ট্রান্সফার ব্যর্থ'}
          </Text>

          <Text style={[styles.subtitle, { color: theme.error }]}>
            {errorMessage}
          </Text>

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.primary, marginTop: 30 }]}
            onPress={handleRetry}
          >
            <Text style={styles.mainButtonText}>
              {language === 'en' ? 'Try Again' : 'আবার চেষ্টা করুন'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  chooseContainer: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: Spacing.xxl },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },

  nfcIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  optionsContainer: {
    flexDirection: 'row', gap: 16, marginTop: 32, width: '100%',
  },
  optionCard: {
    flex: 1, borderRadius: 20, padding: 20, alignItems: 'center',
    borderWidth: 1,
  },
  optionIcon: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  optionTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  optionDesc: { fontSize: 12, textAlign: 'center', marginTop: 4 },

  nfcCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },

  successBadge: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  amountText: { fontSize: 36, fontWeight: '700', marginTop: 12 },
  refText: { fontSize: 11, marginTop: 12 },

  mainButton: {
    paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 14, minWidth: 140, alignItems: 'center',
  },
  mainButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
