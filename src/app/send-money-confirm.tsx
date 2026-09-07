import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import { TransactionProcessingView } from '../components/TransactionProcessingView';
import { useAuth } from '../context/AuthContext';
import { verifyPinLocally } from '../utils/security';

export default function SendMoneyConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

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
    setIsProcessing(true);
  };

  const handleCancel = () => {
    router.back();
  };

  if (isProcessing) {
    return (
      <TransactionProcessingView
        receiverUsername={receiverUsername}
        amount={amount}
        type={type}
      />
    );
  }

  return (
    <TransactionAuthScreen
      title="Confirm Payment"
      summaryLabel="Sending to"
      summaryTitle={receiverUsername}
      amount={amount}
      onAuthorized={handleAuthorized}
      onCancel={handleCancel}
      pinLength={5}
      onVerifyPin={handleVerifyPin}
    />
  );
}
