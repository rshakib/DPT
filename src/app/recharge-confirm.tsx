import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import { TransactionProcessingView } from '../components/TransactionProcessingView';
import { useAuth } from '../context/AuthContext';
import { verifyPinLocally } from '../utils/security';

export default function RechargeConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Unpack routing parameters safely
  const receiverUsername = Array.isArray(params.receiverUsername)
    ? params.receiverUsername[0]
    : params.receiverUsername || 'mobile';

  const mobileNumber = Array.isArray(params.mobileNumber)
    ? params.mobileNumber[0]
    : params.mobileNumber || '';

  const operator = Array.isArray(params.operator)
    ? params.operator[0]
    : params.operator || '';

  const amount = Array.isArray(params.amount)
    ? params.amount[0]
    : params.amount || '0.00';

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
        receiverUsername="mobile"
        amount={amount}
        type="mobile_recharge"
        mobileNumber={mobileNumber}
        operator={operator}
      />
    );
  }

  return (
    <TransactionAuthScreen
      title="Confirm Payment"
      summaryLabel="Recharging"
      summaryTitle={mobileNumber}
      summarySubtitle={operator}
      amount={amount}
      onAuthorized={handleAuthorized}
      onCancel={handleCancel}
      onVerifyPin={handleVerifyPin}
      pinLength={5}
    />
  );
}
