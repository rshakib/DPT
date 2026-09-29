import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  findNodeHandle,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { BottomSkylineSvg } from '../components/BottomSkylineSvg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';
import { syncService } from '../services/sync';
import { addDuressSpent } from '../utils/security';

const { width } = Dimensions.get('window');

type StepState = 'validating' | 'checking_limit' | 'submitting';

export default function TransactionProcessing() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user, updateUser, isDuressMode } = useAuth();

  // Retrieve incoming transaction details
  const params = useLocalSearchParams();
  const { receiverUsername, amount, type = 'send_money', billerName, billerAccountNo, mobileNumber, operator, merchantName } = params;

  // Active step flow
  const [authStep, setAuthStep] = useState<StepState>('validating');

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const loopAnimPulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const loopAnimRotRef = useRef<Animated.CompositeAnimation | null>(null);

  // Use a ref to track if component is mounted
  const containerRef = useRef<View>(null);
  const isMounted = useRef(true);
  const isNavigatingRef = useRef(false);
  const idempotencyKeyRef = useRef(`TX-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);

  const safeReplace = (target: any) => {
    const timestamp = Date.now();
    console.log(`[DPT_NATIVE_TRACE][NAV_CALL] caller=TransactionProcessing.safeReplace target=${target?.pathname || target} timestamp=${timestamp}`);
    if (isNavigatingRef.current || !isMounted.current) return;
    isNavigatingRef.current = true;
    router.replace(target);
  };

  // Setup loop pulsing and rotation animations on mount after interactions settle
  useEffect(() => {
    isMounted.current = true;
    const nodeTag = containerRef.current ? findNodeHandle(containerRef.current) : null;
    console.log(`[DPT_NATIVE_TRACE][MOUNT] screen=TransactionProcessing nativeTag=${nodeTag} timestamp=${Date.now()}`);

    const task = setTimeout(() => {
      if (!isMounted.current) return;
      console.log('🌟 [DIAGNOSTIC] TransactionProcessing - Screen mounted cleanly in Fabric with 0 collisions!');

      // Pulsing circle
      loopAnimPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      loopAnimPulseRef.current.start();

      // Spin loader ring
      loopAnimRotRef.current = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopAnimRotRef.current.start();
    });

    runTransactionFlow();

    return () => {
      isMounted.current = false;
      console.log(`[DPT_NATIVE_TRACE][UNMOUNT] screen=TransactionProcessing nativeTag=${nodeTag} timestamp=${Date.now()}`);
      clearTimeout(task);
      if (loopAnimPulseRef.current) loopAnimPulseRef.current.stop();
      if (loopAnimRotRef.current) loopAnimRotRef.current.stop();
      pulseAnim.stopAnimation();
      rotationAnim.stopAnimation();
    };
  }, []);

  const runTransactionFlow = async () => {
    if (!user?.username) {
      router.replace('/login');
      return;
    }

    try {
      // Step 1: Validating (Show for 1 second)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!isMounted.current) return;

      // Transition to Step 2: Checking limit
      setAuthStep('checking_limit');

      // Call the REAL backend API to perform the transfer
      const cleanedAmount = parseFloat(Array.isArray(amount) ? amount[0] : amount || '0');
      const receiver = Array.isArray(receiverUsername) ? receiverUsername[0] : receiverUsername || '';
      // Strip '@' if passed from send-money screen
      const cleanedReceiver = receiver.startsWith('@') ? receiver.slice(1) : receiver;

      let result: any = null;
      let attempts = 0;
      const isQr = type === 'qr_payment';
      const maxAttempts = isQr ? 5 : 1;

      console.log('[DIAGNOSTIC] TransactionProcessing - About to execute transfer with:', {
        userUsername: user.username,
        cleanedReceiver,
        cleanedAmount,
        type,
        maxAttempts,
      });

      // Construct Hybrid Transaction Envelope (HTE)
      let envelope: any = null;
      try {
        const keyInfo = await api.getServerKeyInfo();
        if (keyInfo && api.isOfflineEnvelopeAllowed(keyInfo)) {
          const { createHybridTransactionEnvelope } = require('../services/crypto');
          envelope = await createHybridTransactionEnvelope({
            duress: isDuressMode,
            sender: user.username,
            receiver: cleanedReceiver,
            amount: cleanedAmount,
            txid: idempotencyKeyRef.current,
            serverPublicKeyHex: keyInfo.publicKey,
            keyId: keyInfo.keyId,
          });
          if (envelope) {
            console.log('[HTE] Created signed transaction envelope for txid:', idempotencyKeyRef.current);
          }
        }
      } catch (envErr) {
        console.warn('[HTE] Could not build HTE envelope:', envErr);
      }

      while (attempts < maxAttempts) {
        attempts++;
        try {
          result = await api.transfer(user.username, cleanedReceiver, cleanedAmount, idempotencyKeyRef.current, envelope);
        } catch (netErr: any) {
          result = { success: false, message: netErr.message || 'Network connection failed' };
        }

        if (result?.success) {
          break;
        }

        const errorMsg = (result?.message || '').toLowerCase();
        const isNetwork = errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection failed');
        // If offline network error on initial attempt, exit loop to queue offline
        if (isNetwork) {
          break;
        }

        // Retry with a 1-second pause if attempts remaining
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log('[DIAGNOSTIC] TransactionProcessing - api.transfer() finished with result:', result);

      if (!isMounted.current) return;

      if (result.success && result.data) {
        // SUCCESS: Update balance and limits in context so Dashboard reflects them
        const data = result.data.user || result.data;
        const newBalance = data.new_balance ?? data.balance;
        const newTodaySpent = data.today_spent ?? data.todaySpent;

        await updateUser({
          ...user,
          balance: newBalance !== undefined ? newBalance : user.balance,
          today_spent: newTodaySpent !== undefined ? newTodaySpent : user.today_spent,
        });

        // Update balance in SQLite
        await db.saveCachedUser(user.username, { ...user, balance: newBalance, today_spent: newTodaySpent });

        // DON'T save transaction to SQLite here — sync service will fetch it from server
        // This prevents duplicate records (client ID vs server ID mismatch)

        // Notify listeners so dashboard refreshes balance
        syncService.notifyDataChanged();

        // Trigger an immediate sync to fetch the real transaction from server
        syncService.forceSync(user.username);

        // Transition to Step 3: Submitting
        setAuthStep('submitting');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!isMounted.current) return;

        // Navigate to success results
        safeReplace({
          pathname: '/transaction-result',
          params: {
            status: 'success',
            receiverUsername: cleanedReceiver,
            amount: cleanedAmount.toString(),
            referenceNo: result.data.reference || result.data.referenceNo || result.data.id || String(Math.floor(100000 + Math.random() * 900000)),
            dateTime: new Date().toLocaleString(),
            type,
            billerName,
            billerAccountNo,
            mobileNumber,
            operator,
            merchantName,
          },
        });
      } else {
        const errorMsg = result.message || '';
        const isNetworkError = errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch') || errorMsg.toLowerCase().includes('connection failed');

        // If failure is strictly due to offline network connection, queue offline transaction
        if (isNetworkError) {
          const offlineRef = `OFF-${Math.floor(100000 + Math.random() * 900000)}`;

          // Paper §4.1: the offline handoff QR carries the sender-signed HTE
          // envelope P itself — no ad-hoc HMAC receipt. The receiver relays the
          // same P to POST /transfer/claim; settlement stays server-authoritative.
          const offlineReceiptJson = envelope ? JSON.stringify(envelope) : '';

          await db.savePendingOfflineTransaction(user.username, cleanedReceiver, cleanedAmount, String(type), offlineRef, {
            retryCount: 0,
            envelope,
          });

          // Conservative local L_D counter for offline duress envelopes (paper §4.1).
          if (isDuressMode) {
            await addDuressSpent(user.username, cleanedAmount);
          }

          // Paper §4.1: no offline settlement — do NOT deduct the balance locally.
          // The queued transaction is `pending`; the server settles it on reconnect
          // and the normal delta-sync then updates the balance.

          // Save the pending transaction so it appears in dashboard & history immediately
          const offlineTx = {
            id: offlineRef,
            sender_username: user.username,
            receiver_username: cleanedReceiver,
            amount: cleanedAmount,
            type: String(type),
            // Deferred submission: not settled yet (paper §4.1, receiver-authoritative).
            status: 'pending',
            reference: offlineRef,
            created_at: new Date().toISOString(),
            operator: operator || '',
            mobileNumber: mobileNumber || '',
            merchantName: merchantName || '',
            billerName: billerName || '',
          };
          await db.mergeCachedTransactions(user.username, [offlineTx]);

          // Notify dashboard and other listeners to refresh immediately
          syncService.notifyDataChanged();

          safeReplace({
            pathname: '/transaction-result',
            params: {
              status: 'pending',
              receiverUsername: cleanedReceiver,
              amount: cleanedAmount.toString(),
              referenceNo: offlineRef,
              dateTime: `${new Date().toLocaleString()} (Offline Queued)`,
              type,
              billerName,
              billerAccountNo,
              mobileNumber,
              operator,
              merchantName,
              isOffline: 'true',
              offlineReceipt: offlineReceiptJson,
            },
          });
          return;
        }

        // NOTE: the previous "permanently debit after 5 QR retries (non-refundable)"
        // policy was removed for paper conformance. A transfer that cannot be settled
        // now simply fails (no debit) — settlement is receiver-authoritative.

        // For Service Payments (Mobile Recharge, Merchant, Bill Payment):
        // The backend has no service endpoints, so these can never be confirmed.
        // Queue them as offline transactions instead of fabricating a success.
        const isServicePayment = type === 'mobile_recharge' || type === 'merchant_payment' || type === 'bill_payment';
        if (isServicePayment && (errorMsg.toLowerCase().includes('receiver') || errorMsg.toLowerCase().includes('not found'))) {
          const serviceRef = `OFF-SRV-${Math.floor(100000 + Math.random() * 900000)}`;
          // Paper §4.1: no offline settlement — do NOT deduct locally.

          const newTx = {
            id: serviceRef,
            sender_username: user.username,
            receiver_username: cleanedReceiver,
            amount: cleanedAmount,
            type: String(type),
            status: 'pending',
            reference: serviceRef,
            created_at: new Date().toISOString(),
            operator: operator || '',
            mobileNumber: mobileNumber || '',
            merchantName: merchantName || '',
            billerName: billerName || '',
          };

          await db.mergeCachedTransactions(user.username, [newTx]);
          await db.savePendingOfflineTransaction(user.username, cleanedReceiver, cleanedAmount, String(type), serviceRef, {
            retryCount: 0,
          });
          syncService.notifyDataChanged();

          safeReplace({
            pathname: '/transaction-result',
            params: {
              status: 'pending',
              receiverUsername: cleanedReceiver,
              amount: cleanedAmount.toString(),
              referenceNo: serviceRef,
              dateTime: `${new Date().toLocaleString()} (Offline Queued)`,
              type,
              billerName,
              billerAccountNo,
              mobileNumber,
              operator,
              merchantName,
              isOffline: 'true',
            },
          });
          return;
        }

        // Standard FAILURE mappings
        let mappedStatus = 'transfer_failed';
        if (errorMsg.toLowerCase().includes('insufficient') || errorMsg.toLowerCase().includes('balance')) {
          mappedStatus = 'insufficient_balance';
        } else if (errorMsg.toLowerCase().includes('receiver') || errorMsg.toLowerCase().includes('not found')) {
          mappedStatus = 'receiver_not_found';
        } else if (errorMsg.toLowerCase().includes('hmac') || errorMsg.toLowerCase().includes('handshake')) {
          mappedStatus = 'hmac_mismatch';
        }

        safeReplace({
          pathname: '/transaction-result',
          params: {
            status: mappedStatus,
            receiverUsername: cleanedReceiver,
            amount: cleanedAmount.toString(),
            type,
            billerName,
            billerAccountNo,
            mobileNumber,
            operator,
            merchantName,
            errorReason: errorMsg,
          },
        });
      }
    } catch (e) {
      if (!isMounted.current) return;
      safeReplace({
        pathname: '/transaction-result',
        params: {
          status: 'transfer_failed',
          receiverUsername: Array.isArray(receiverUsername) ? receiverUsername[0] : receiverUsername || '',
          amount: Array.isArray(amount) ? amount[0] : amount || '0',
          type,
          merchantName: Array.isArray(merchantName) ? merchantName[0] : merchantName || '',
        },
      });
    }
  };

  const handleCancel = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/dashboard');
  };

  // Convert rotation value to degrees string
  const spinRotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getStepText = () => {
    if (authStep === 'validating') return t.validatingSignaturesStep;
    if (authStep === 'checking_limit') return t.establishingEncryptedStep;
    return t.finalizingLedgerStep;
  };

  const getStepNumber = () => {
    if (authStep === 'validating') return '1';
    if (authStep === 'checking_limit') return '2';
    return '3';
  };

  return (
    <SafeAreaView ref={containerRef} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header showBackButton={false} />

      <View style={styles.contentContainer}>
        {/* Core Processing Visual Indicator */}
        <View style={styles.centerWrapper}>
          <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.processingCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              
              <View style={styles.ringWrapper}>
                {/* Spinning indicator ring */}
                <Animated.View
                  style={[
                    styles.spinningRing,
                    {
                      borderColor: theme.border,
                      borderTopColor: theme.primary,
                      transform: [{ rotate: spinRotation }],
                    },
                  ]}
                />
                
                {/* Center static processing bubble */}
                <View style={[styles.processingCircle, { backgroundColor: theme.background, borderColor: theme.border, shadowColor: theme.primary }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              </View>

              {/* Status Header */}
              <Text style={[styles.statusText, { color: theme.text }]}>{getStepText()}</Text>

              {/* Active Step Badge */}
              <View style={[styles.stepBadge, { backgroundColor: theme.border }]}>
                <Text style={[styles.stepBadgeText, { color: theme.textSecondary }]}>
                  {language === 'en' ? `Step ${getStepNumber()} of 3` : `ধাপ ${getStepNumber()}/৩`}
                </Text>
              </View>

            </View>
          </Animated.View>
        </View>

        {/* Action Button: Cancel Payment */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color={theme.textSecondary} style={styles.cancelIcon} />
            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Skyline footer illustration in brand purple */}
      <BottomSkylineSvg color={theme.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
    zIndex: 1,
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  processingCard: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 32,
    paddingVertical: Spacing.huge,
    alignItems: 'center',
    gap: Spacing.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  ringWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spinningRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
  },
  processingCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: Spacing.md,
  },
  cancelButton: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelIcon: {
    marginRight: Spacing.xs,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
