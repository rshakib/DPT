import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import { useAuth } from '../context/AuthContext';
import { verifyPinLocally } from '../utils/security';

export default function MerchantConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  // Unpack routing parameters safely
  const merchantName = Array.isArray(params.merchantName)
    ? params.merchantName[0]
    : params.merchantName || 'Merchant';

  const receiverUsername = Array.isArray(params.receiverUsername)
    ? params.receiverUsername[0]
    : params.receiverUsername || 'merchant';

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
        receiverUsername,
        amount,
        type: 'merchant_payment',
        merchantName,
      },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <TransactionAuthScreen
      title="Confirm Payment"
      summaryLabel="Paying"
      summaryTitle={merchantName}
      summarySubtitle={"@" + receiverUsername}
      amount={amount}
      onAuthorized={handleAuthorized}
      onCancel={handleCancel}
      onVerifyPin={handleVerifyPin}
      pinLength={8}
    />
  );
}
