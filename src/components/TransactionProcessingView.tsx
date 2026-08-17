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
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from './Header';
import { BottomSkylineSvg } from './BottomSkylineSvg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';

import { generateUUID } from '../utils/security';

const { width } = Dimensions.get('window');

type StepState = 'validating' | 'checking_limit' | 'submitting';

export interface TransactionProcessingViewProps {
  receiverUsername: string;
  amount: string;
  type?: string;
  billerName?: string;
  billerAccountNo?: string;
  mobileNumber?: string;
  operator?: string;
  merchantName?: string;
}

export function TransactionProcessingView({
  receiverUsername,
  amount,
  type = 'send_money',
  billerName,
  billerAccountNo,
  mobileNumber,
  operator,
  merchantName,
}: TransactionProcessingViewProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user, updateUser } = useAuth();

  const [authStep, setAuthStep] = useState<StepState>('validating');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const loopAnimPulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const loopAnimRotRef = useRef<Animated.CompositeAnimation | null>(null);

  const isMounted = useRef(true);
  const isNavigatingRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(generateUUID());

  const safeReplace = (target: any) => {
    if (isNavigatingRef.current || !isMounted.current) return;
    isNavigatingRef.current = true;
    router.replace(target);
  };

  useEffect(() => {
    isMounted.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      if (!isMounted.current) return;

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
      task.cancel();
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!isMounted.current) return;

      setAuthStep('checking_limit');

      const cleanedAmount = parseFloat(Array.isArray(amount) ? amount[0] : amount || '0');
      const receiver = Array.isArray(receiverUsername) ? receiverUsername[0] : receiverUsername || '';
      const cleanedReceiver = receiver.startsWith('@') ? receiver.slice(1) : receiver;

      const result = await api.transfer(user.username, cleanedReceiver, cleanedAmount, idempotencyKeyRef.current);

      if (!isMounted.current) return;

      if (result.success && result.data) {
        const data = result.data.user || result.data;
        const newBalance = data.new_balance ?? data.balance;
        const newTodaySpent = data.today_spent ?? data.todaySpent;

        await updateUser({
          ...user,
          balance: newBalance !== undefined ? newBalance : user.balance,
          today_spent: newTodaySpent !== undefined ? newTodaySpent : user.today_spent,
        });

        setAuthStep('submitting');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!isMounted.current) return;

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

        if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('connection failed')) {
          const offlineRef = `OFF-${Math.floor(100000 + Math.random() * 900000)}`;
          await db.savePendingOfflineTransaction(user.username, cleanedReceiver, cleanedAmount, String(type), offlineRef);

          const currentBal = parseFloat(user.balance || 0);
          const newBal = Math.max(0, currentBal - cleanedAmount);
          await updateUser({
            ...user,
            balance: newBal,
          });

          safeReplace({
            pathname: '/transaction-result',
            params: {
              status: 'success',
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
            },
          });
          return;
        }

        const isServicePayment = type === 'mobile_recharge' || type === 'merchant_payment' || type === 'bill_payment';
        if (isServicePayment && (errorMsg.toLowerCase().includes('receiver') || errorMsg.toLowerCase().includes('not found'))) {
          const serviceRef = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;
          const currentBal = parseFloat(user.balance || 0);
          const newBal = Math.max(0, currentBal - cleanedAmount);
          const currentSpent = parseFloat(user.today_spent || 0);
          const newSpent = currentSpent + cleanedAmount;

          await updateUser({
            ...user,
            balance: newBal,
            today_spent: newSpent,
          });

          const newTx = {
            id: serviceRef,
            sender_username: user.username,
            receiver_username: cleanedReceiver,
            amount: cleanedAmount,
            type: String(type),
            status: 'success',
            reference: serviceRef,
            created_at: new Date().toISOString(),
            operator: operator || '',
            mobileNumber: mobileNumber || '',
            merchantName: merchantName || '',
            billerName: billerName || '',
          };

          await db.mergeCachedTransactions(user.username, [newTx]);

          safeReplace({
            pathname: '/transaction-result',
            params: {
              status: 'success',
              receiverUsername: cleanedReceiver,
              amount: cleanedAmount.toString(),
              referenceNo: serviceRef,
              dateTime: new Date().toLocaleString(),
              type,
              billerName,
              billerAccountNo,
              mobileNumber,
              operator,
              merchantName,
            },
          });
          return;
        }

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
    } catch (err: any) {
      if (!isMounted.current) return;
      safeReplace({
        pathname: '/transaction-result',
        params: {
          status: 'transfer_failed',
          receiverUsername: Array.isArray(receiverUsername) ? receiverUsername[0] : receiverUsername || '',
          amount: String(amount || '0'),
          type,
          errorReason: err.message || 'System error occurred',
        },
      });
    }
  };

  const handleCancel = () => {
    isNavigatingRef.current = true;
    router.replace('/dashboard');
  };

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header showBackButton={false} />

      <View style={styles.contentContainer}>
        <View style={styles.centerWrapper}>
          <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.processingCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              
              <View style={styles.ringWrapper}>
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
                
                <View style={[styles.processingCircle, { backgroundColor: theme.background, borderColor: theme.border, shadowColor: theme.primary }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              </View>

              <Text style={[styles.statusText, { color: theme.text }]}>{getStepText()}</Text>

              <View style={[styles.stepBadge, { backgroundColor: theme.border }]}>
                <Text style={[styles.stepBadgeText, { color: theme.textSecondary }]}>
                  {language === 'en' ? `Step ${getStepNumber()} of 3` : `ধাপ ${getStepNumber()}/৩`}
                </Text>
              </View>

            </View>
          </Animated.View>
        </View>

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
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  stepBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  cancelButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelIcon: {
    marginRight: Spacing.xs,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
