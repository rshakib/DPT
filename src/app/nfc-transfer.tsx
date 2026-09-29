import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
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
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import {
  isNFCAvailable,
  stopNFC,
  generateNFCTransferId,
  generateNonce,
  NFCTransferPayload,
  startHceReceiver,
  stopHceReceiver,
  subscribeHcePayment,
  sendIsoDepPayment,
  popReceivedPayment,
  validateNfcPayload,
} from '../services/nfc';
import * as db from '../services/db';
import { syncService } from '../services/sync';
import { verifyPinLocally } from '../utils/security';

const { width } = Dimensions.get('window');

type NFCStep = 'choose' | 'auth' | 'enter-amount' | 'waiting-tap' | 'success' | 'error';

export default function NFCTransfer() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState<NFCStep>('choose');
  const [mode, setMode] = useState<'send' | 'receive' | null>(null);
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<NFCTransferPayload | null>(null);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hceSubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // P0 FIX: Mutex to prevent double processing of same payment
  const paymentProcessedRef = useRef(false);

  useEffect(() => {
    checkNFC();
    return () => {
      stopNFC();
      stopHceReceiver();
      if (hceSubRef.current) {
        hceSubRef.current.unsubscribe();
        hceSubRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
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

  // SEND: enter amount first, then PIN + Biometric auth
  const handleSendPress = () => {
    setMode('send');
    setStep('enter-amount');
  };

  // RECEIVE: wait for sender to tap
  const handleReceivePress = () => {
    setMode('receive');
    setStep('waiting-tap');
    paymentProcessedRef.current = false; // Reset mutex
    startReceiver();
  };

  // Local hardware-isolated PIN verification
  const handleVerifyPin = async (pinInput: string) => {
    if (!user?.username) {
      return {
        success: false,
        message: language === 'en' ? 'User session not found.' : 'ব্যবহারকারীর সেশন পাওয়া যায়নি।',
      };
    }
    return await verifyPinLocally(user.username, pinInput);
  };

  // After PIN + Biometric auth success → start the NFC transfer
  const handleAuthSuccess = () => {
    const amountNum = parseFloat(amount);
    setStep('waiting-tap');
    paymentProcessedRef.current = false;
    startSender(amountNum);
  };

  // Auth cancelled → back to amount entry
  const handleAuthCancel = () => {
    setStep('enter-amount');
  };

  // After entering amount, go to PIN + Biometric auth
  const handleAmountSubmit = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage(language === 'en' ? 'Enter a valid amount' : 'সঠিক পরিমাণ লিখুন');
      return;
    }
    if (amountNum > (user?.balance || 0)) {
      setErrorMessage(language === 'en' ? 'Insufficient balance' : 'অপর্যাপ্ত ব্যালেন্স');
      return;
    }
    const dailyLimit = Number(user?.daily_limit || user?.dailyLimit || 50000);
    const todaySpent = Number(user?.today_spent || user?.todaySpent || 0);
    if (todaySpent + amountNum > dailyLimit) {
      const remainingLimit = Math.max(0, dailyLimit - todaySpent);
      setErrorMessage(
        language === 'en'
          ? `Daily limit exceeded. Remaining limit: ৳${remainingLimit.toLocaleString()}`
          : `দৈনিক সীমা অতিক্রম করেছে। অবশিষ্ট সীমা: ৳${remainingLimit.toLocaleString()}`
      );
      return;
    }
    setStep('auth');
  };

  // NFC SEND (Phone-to-Phone IsoDep)
  const startSender = async (amountNum: number) => {
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const payload: NFCTransferPayload = {
        type: 'DPT_P2P_TRANSFER',
        version: 1,
        sender: user!.username,
        receiver: '',
        amount: amountNum,
        timestamp: new Date().toISOString(),
        txid: generateNFCTransferId(),
        nonce: generateNonce(),
      };

      console.log('[NFC-Sender] Attempting IsoDep connection to receiver phone...');
      const isoDepResult = await sendIsoDepPayment(payload);

      if (isoDepResult.success) {
        const finalPayload = { ...payload, receiver: isoDepResult.receiver || 'receiver' };

        await saveLocalTransaction(finalPayload);

        // Persist in pending offline queue for automatic server delta reconciliation
        await db.savePendingOfflineTransaction(
          user!.username,
          finalPayload.receiver,
          amountNum,
          'nfc_transfer',
          payload.txid
        );

        const newBalance = (user!.balance || 0) - amountNum;
        const newSpent = (user!.today_spent || 0) + amountNum;
        await updateUser({ ...user!, balance: newBalance, today_spent: newSpent });
        await db.saveCachedUser(user!.username, { ...user, balance: newBalance, today_spent: newSpent });

        syncService.notifyDataChanged();
        syncService.forceSync(user!.username);

        setSuccessData(finalPayload);
        setStep('success');

        Alert.alert(
          language === 'en' ? 'Sent!' : 'পাঠানো হয়েছে!',
          language === 'en'
            ? `৳${amountNum} sent to @${finalPayload.receiver}`
            : `৳${amountNum} @${finalPayload.receiver}-এ পাঠানো হয়েছে`
        );
      } else {
        throw new Error(language === 'en' ? 'NFC transfer could not be completed.' : 'NFC ট্রান্সফার সম্পন্ন করা সম্ভব হয়নি।');
      }
    } catch (e: any) {
      // Handle cancellation gracefully
      if (e?.code === 'CANCELLED' || e?.message?.includes('cancelled')) {
        setStep('choose');
        setMode(null);
        return;
      }
      setErrorMessage(e.message || (language === 'en' ? 'Transfer failed' : 'ট্রান্সফার ব্যর্থ'));
      setStep('error');
    } finally {
      setIsProcessing(false);
      await stopNFC();
    }
  };

  // P0 FIX: Process incoming payment with mutex guard
  const processIncomingPayment = async (senderPayload: NFCTransferPayload) => {
    // P1 FIX: Validate payload before processing
    const validation = validateNfcPayload(senderPayload);
    if (!validation.valid) {
      console.warn('[NFC-Receiver] Invalid payload rejected:', validation.error);
      return;
    }

    // P0 FIX: Mutex guard - prevent double processing
    if (paymentProcessedRef.current) {
      console.log('[NFC-Receiver] Payment already processed, ignoring duplicate');
      return;
    }
    paymentProcessedRef.current = true;

    try {
      // Stop polling immediately
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      await saveLocalTransaction({ ...senderPayload, receiver: user!.username }, true);

      const newBalance = (user!.balance || 0) + senderPayload.amount;
      await updateUser({ ...user!, balance: newBalance });
      await db.saveCachedUser(user!.username, { ...user, balance: newBalance });

      syncService.notifyDataChanged();
      syncService.forceSync(user!.username);

      setSuccessData(senderPayload);
      setStep('success');

      Alert.alert(
        language === 'en' ? 'Received!' : 'পেয়েছেন!',
        language === 'en'
          ? `৳${senderPayload.amount} from @${senderPayload.sender}`
          : `৳${senderPayload.amount} @${senderPayload.sender}-এর কাছ থেকে`
      );
    } catch (err: any) {
      console.error('[NFC-Receiver] Error saving incoming payment:', err);
      paymentProcessedRef.current = false; // Reset on error to allow retry
    } finally {
      await stopHceReceiver();
    }
  };

  // NFC RECEIVE (Host Card Emulation for Phone-to-Phone)
  const startReceiver = async () => {
    setIsProcessing(true);
    setErrorMessage('');

    try {
      // 1. Activate Native Android HCE (Card Emulation)
      const hceStarted = await startHceReceiver(user!.username);
      console.log('[NFC-Receiver] Native HCE started:', hceStarted);

      // Fail fast with an actionable message instead of silently waiting forever
      if (!hceStarted) {
        setErrorMessage(
          language === 'en'
            ? 'NFC card emulation is unavailable in this build. Please reinstall the app.'
            : 'এই বিল্ডে NFC কার্ড এমুলেশন নেই। অনুগ্রহ করে অ্যাপটি পুনরায় ইনস্টল করুন।'
        );
        setStep('error');
        setIsProcessing(false);
        return;
      }

      // 2. Clear any existing listeners or polling
      if (hceSubRef.current) {
        hceSubRef.current.unsubscribe();
        hceSubRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // 3. Push listener: Listen for native HCE event
      hceSubRef.current = subscribeHcePayment(processIncomingPayment);

      // 4. Pull fallback: Poll native buffer every 350ms to guarantee zero packet loss
      pollingIntervalRef.current = setInterval(async () => {
        // Skip polling if payment already processed (mutex)
        if (paymentProcessedRef.current) {
          return;
        }
        try {
          const buffered = await popReceivedPayment();
          if (buffered && buffered.type === 'DPT_P2P_TRANSFER') {
            console.log('[NFC-Receiver] Found payment via active polling buffer:', buffered);
            await processIncomingPayment(buffered);
          }
        } catch (pollErr) {
          console.warn('[NFC-Receiver] Polling check notice:', pollErr);
        }
      }, 350);

    } catch (e: any) {
      setErrorMessage(e.message || (language === 'en' ? 'Receive failed' : 'গ্রহণ ব্যর্থ'));
      setStep('error');
      setIsProcessing(false);
      await stopNFC();
      await stopHceReceiver();
    }
  };

  const saveLocalTransaction = async (payload: NFCTransferPayload, isPlaceholder = false) => {
    // The receiver persists an instant local credit before the server knows about
    // the transfer. Tag it as a placeholder so the canonical server row (which has
    // a different UUID) supersedes it instead of showing up as a duplicate.
    const localId = isPlaceholder ? `LOCAL-RECV-${payload.txid}` : payload.txid;
    const tx = {
      id: localId,
      sender_username: payload.sender,
      receiver_username: payload.receiver,
      amount: payload.amount,
      type: 'nfc_transfer',
      status: 'success',
      reference: payload.txid,
      created_at: payload.timestamp,
    };
    await db.mergeCachedTransactions(user!.username, [tx]);
  };

  const handleRetry = () => {
    stopNFC();
    stopHceReceiver();
    if (hceSubRef.current) {
      hceSubRef.current.unsubscribe();
      hceSubRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    paymentProcessedRef.current = false;
    setStep('choose');
    setMode(null);
    setAmount('');
    setErrorMessage('');
    setSuccessData(null);
  };

  const handleDone = () => {
    stopNFC();
    stopHceReceiver();
    if (hceSubRef.current) {
      hceSubRef.current.unsubscribe();
      hceSubRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
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
              ? 'This device does not support NFC or NFC is disabled.'
              : 'এই ডিভাইসে NFC সাপোর্ট করে না বা NFC বন্ধ আছে।'}
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
      {step !== 'auth' && <Header title="NFC Transfer" />}

      {/* STEP: Choose Send or Receive */}
      {step === 'choose' && (
        <View style={styles.chooseContainer}>
          <View style={[styles.nfcIconBig, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="wifi" size={48} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            {language === 'en' ? 'NFC Transfer' : 'NFC ট্রান্সফার'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'en'
              ? 'Send or receive money by tapping phones'
              : 'ফোন ট্যাপ করে টাকা পাঠান বা গ্রহণ করুন'}
          </Text>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.primary }]}
              onPress={handleSendPress}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-up-circle" size={40} color="#FFFFFF" />
              <Text style={styles.optionTitle}>
                {language === 'en' ? 'Send' : 'পাঠান'}
              </Text>
              <Text style={styles.optionDesc}>
                {language === 'en' ? 'Tap to send money' : 'টাকা পাঠাতে ট্যাপ করুন'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.success }]}
              onPress={handleReceivePress}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-down-circle" size={40} color="#FFFFFF" />
              <Text style={styles.optionTitle}>
                {language === 'en' ? 'Receive' : 'গ্রহণ করুন'}
              </Text>
              <Text style={styles.optionDesc}>
                {language === 'en' ? 'Wait for sender tap' : 'প্রেরকের ট্যাপের জন্য অপেক্ষা করুন'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Architecture note */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#F5F4FA',
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
            <Text style={[styles.infoCardText, { color: theme.textSecondary }]}>
              {language === 'en'
                ? 'Both phones must have NFC enabled. Hold the back of both phones together during transfer.'
                : 'দুটো ফোনে NFC চালু থাকতে হবে। ট্রান্সফারের সময় দুটো ফোনের ব্যাক একসাথে ধরুন।'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.qrAlternativeButton, { borderColor: theme.primary }]}
            onPress={() => router.push('/qr-pay')}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={18} color={theme.primary} />
            <Text style={[styles.qrAlternativeText, { color: theme.primary }]}>
              {language === 'en' ? 'Switch to Offline QR Pay' : 'অফলাইন QR Pay ব্যবহার করুন'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP: PIN + Biometric Auth (Send only) */}
      {step === 'auth' && (
        <TransactionAuthScreen
          summaryLabel={language === 'en' ? 'NFC Transfer' : 'NFC ট্রান্সফার'}
          summaryTitle={language === 'en' ? 'Authorize Transfer' : 'ট্রান্সফার অনুমোদন'}
          summarySubtitle={language === 'en' ? 'Verify your identity to send money' : 'টাকা পাঠাতে আপনার পরিচয় যাচাই করুন'}
          amount={amount || '0'}
          onAuthorized={handleAuthSuccess}
          onCancel={handleAuthCancel}
          onVerifyPin={handleVerifyPin}
        />
      )}

      {/* STEP: Enter Amount (Send only) */}
      {step === 'enter-amount' && (
        <View style={styles.amountContainer}>
          <Text style={[styles.title, { color: theme.text }]}>
            {language === 'en' ? 'Enter Amount' : 'পরিমাণ লিখুন'}
          </Text>

          <View style={styles.amountRow}>
            <Text style={[styles.currencySign, { color: theme.primary }]}>৳</Text>
            <TextInput
              style={[styles.amountInput, { color: theme.text }]}
              value={amount}
              onChangeText={(text) => {
                setAmount(text.replace(/[^0-9.]/g, ''));
                setErrorMessage('');
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={isDarkMode ? '#555' : '#CCC'}
              autoFocus
            />
          </View>

          <Text style={[styles.balanceText, { color: theme.textSecondary }]}>
            {language === 'en' ? 'Balance' : 'ব্যালেন্স'}: ৳{user?.balance?.toLocaleString() || '0'}
          </Text>

          {errorMessage ? (
            <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
          ) : null}

          <View style={styles.amountButtons}>
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: theme.border }]}
              onPress={() => { setStep('choose'); setMode(null); setAmount(''); }}
            >
              <Text style={[styles.mainButtonText, { color: theme.text }]}>
                {language === 'en' ? 'Cancel' : 'বাতিল'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: theme.primary }]}
              onPress={handleAmountSubmit}
            >
              <Text style={styles.mainButtonText}>
                {language === 'en' ? 'Next' : 'পরবর্তী'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP: Waiting for NFC Tap */}
      {step === 'waiting-tap' && (
        <View style={styles.waitingContainer}>
          <Animated.View
            style={[
              styles.nfcCircle,
              {
                borderColor: mode === 'send' ? theme.primary : theme.success,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons name="wifi" size={56} color={mode === 'send' ? theme.primary : theme.success} />
          </Animated.View>

          <Text style={[styles.title, { color: theme.text, marginTop: 24 }]}>
            {mode === 'send'
              ? language === 'en' ? `Sending ৳${amount}` : `৳${amount} পাঠাচ্ছে`
              : language === 'en' ? 'Ready to Receive' : 'টাকা গ্রহণের জন্য প্রস্তুত'}
          </Text>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'en'
              ? 'Hold the back of both phones together until they vibrate'
              : 'দুটো ফোনের ব্যাক একসাথে স্পর্শ করে রাখুন যতক্ষণ না ভাইব্রেট করে'}
          </Text>

          {/* Status indicator */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F0F3F6',
                borderColor: mode === 'send' ? theme.primary : theme.success,
              },
            ]}
          >
            <Ionicons
              name={mode === 'send' ? 'radio-outline' : 'card-outline'}
              size={16}
              color={mode === 'send' ? theme.primary : theme.success}
            />
            <Text
              style={[
                styles.statusText,
                { color: mode === 'send' ? theme.primary : theme.success },
              ]}
            >
              {mode === 'send'
                ? language === 'en' ? 'Searching for receiver...' : 'গ্রাহক খুঁজছে...'
                : language === 'en' ? 'Waiting for sender...' : 'প্রেরকের জন্য অপেক্ষা...'}
            </Text>
          </View>

          {isProcessing && (
            <ActivityIndicator size="large" color={mode === 'send' ? theme.primary : theme.success} style={{ marginTop: 16 }} />
          )}

          <TouchableOpacity
            style={[styles.qrAlternativeButton, { borderColor: theme.primary, marginTop: 24 }]}
            onPress={() => {
              stopNFC();
              if (mode === 'send') {
                router.push('/qr-pay');
              } else {
                router.push('/my-qr');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={18} color={theme.primary} />
            <Text style={[styles.qrAlternativeText, { color: theme.primary }]}>
              {language === 'en' ? 'Switch to Offline QR Pay' : 'অফলাইন QR Pay-তে যান'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.border, marginTop: 12 }]}
            onPress={() => { stopNFC(); handleRetry(); }}
          >
            <Text style={[styles.mainButtonText, { color: theme.text }]}>
              {language === 'en' ? 'Cancel' : 'বাতিল'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP: Success */}
      {step === 'success' && successData && (
        <View style={styles.successContainer}>
          <View style={[styles.successBadge, { backgroundColor: mode === 'send' ? theme.primary : theme.success }]}>
            <Ionicons name="checkmark" size={48} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, { color: theme.text, marginTop: 20 }]}>
            {mode === 'send'
              ? language === 'en' ? 'Sent!' : 'পাঠানো হয়েছে!'
              : language === 'en' ? 'Received!' : 'পেয়েছেন!'}
          </Text>

          <Text style={[styles.amountBig, { color: mode === 'send' ? theme.primary : theme.success }]}>
            {mode === 'send' ? '-' : '+'} ৳{successData.amount}
          </Text>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {mode === 'send'
              ? language === 'en' ? `To @${successData.receiver}` : `@${successData.receiver}-এ`
              : language === 'en' ? `From @${successData.sender}` : `@${successData.sender}-এর কাছ থেকে`}
          </Text>

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.primary, marginTop: 30 }]}
            onPress={handleDone}
          >
            <Text style={styles.mainButtonText}>
              {language === 'en' ? 'Done' : 'সম্পন্ন'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP: Error */}
      {step === 'error' && (
        <View style={styles.errorContainer}>
          <Ionicons name="close-circle" size={72} color={theme.error} />
          <Text style={[styles.title, { color: theme.text, marginTop: 20 }]}>
            {language === 'en' ? 'Transfer Failed' : 'ট্রান্সফার ব্যর্থ'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.error, marginTop: 8 }]}>{errorMessage}</Text>

          <TouchableOpacity
            style={[
              styles.mainButton,
              { backgroundColor: theme.primary, marginTop: 24, flexDirection: 'row', justifyContent: 'center' },
            ]}
            onPress={() => {
              stopNFC();
              if (mode === 'send') {
                router.push('/qr-pay');
              } else {
                router.push('/my-qr');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.mainButtonText}>
              {language === 'en' ? 'Use Offline QR Pay' : 'অফলাইন QR Pay ব্যবহার করুন'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: theme.border, marginTop: 12 }]}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Text style={[styles.mainButtonText, { color: theme.text }]}>
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
  amountContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },

  nfcIconBig: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  optionsRow: {
    flexDirection: 'row', gap: 16, marginTop: 32, width: '100%',
  },
  optionCard: {
    flex: 1, borderRadius: 20, padding: 24, alignItems: 'center',
  },
  optionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 12 },
  optionDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4, textAlign: 'center' },

  amountRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 32,
  },
  currencySign: { fontSize: 44, fontWeight: '700', marginRight: 8 },
  amountInput: { fontSize: 48, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  balanceText: { fontSize: 14, marginTop: 12 },

  amountButtons: {
    flexDirection: 'row', gap: 16, marginTop: 32, width: '100%',
  },

  nfcCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },

  successBadge: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  amountBig: { fontSize: 36, fontWeight: '700', marginTop: 12 },

  mainButton: {
    paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 14, minWidth: 140, alignItems: 'center',
  },
  mainButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  errorText: { fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    width: '100%',
    gap: 10,
  },
  infoCardText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  qrAlternativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 14,
    width: '100%',
    gap: 8,
  },
  qrAlternativeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
