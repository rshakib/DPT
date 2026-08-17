import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import { useAuth } from '../context/AuthContext';
import { verifyPinLocally } from '../utils/security';

export default function SendMoneyConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  // Unpack routing parameters safely
  const receiverUsername = Array.isArray(params.receiverUsername)
    ? params.receiverUsername[0]
    : params.receiverUsername || '';
  const amount = Array.isArray(params.amount)
    ? params.amount[0]
    : params.amount || '';
  const type = Array.isArray(params.type)
    ? params.type[0]
    : params.type || 'user_transfer';

  const handleVerifyPin = async (pin: string) => {
    if (!user?.username) {
      return { success: false, message: 'User session not found.' };
    }

    return await verifyPinLocally(user.username, pin);
  };

  const handleAuthorized = () => {
    router.replace({
      pathname: '/transaction-processing',
      params: {
        receiverUsername,
        amount,
        type,
      },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <TransactionAuthScreen
      title="Confirm Payment"
      summaryLabel="Sending to"
      summaryTitle={receiverUsername}
      amount={amount}
      onAuthorized={handleAuthorized}
      onCancel={handleCancel}
      pinLength={8}
      onVerifyPin={handleVerifyPin}
    />
  );
}
