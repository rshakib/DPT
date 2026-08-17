import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import { useAuth } from '../context/AuthContext';
import { verifyPinLocally } from '../utils/security';

export default function QRPayConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  // Unpack routing parameters safely
  const merchantName = Array.isArray(params.merchantName)
    ? params.merchantName[0]
    : params.merchantName || 'Merchant';
  const merchantHandle = Array.isArray(params.merchantHandle)
    ? params.merchantHandle[0]
    : params.merchantHandle || '@merchant';
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
    router.replace({
      pathname: '/transaction-processing',
      params: {
        receiverUsername: merchantHandle,
        amount,
        type: 'qr_payment',
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
      summaryTitle={merchantName}
      summarySubtitle={merchantHandle}
      amount={amount}
      onAuthorized={handleAuthorized}
      onCancel={handleCancel}
      pinLength={8}
      onVerifyPin={handleVerifyPin}
    />
  );
}
