import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionAuthScreen } from '../components/TransactionAuthScreen';
import { useAuth } from '../context/AuthContext';
import { verifyPinLocally } from '../utils/security';

export default function BillConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  // Unpack routing parameters safely
  const receiverUsername = Array.isArray(params.receiverUsername)
    ? params.receiverUsername[0]
    : params.receiverUsername || 'dpdc';
  const billerName = Array.isArray(params.billerName)
    ? params.billerName[0]
    : params.billerName || 'Biller';
  const billerAccountNo = Array.isArray(params.billerAccountNo)
    ? params.billerAccountNo[0]
    : params.billerAccountNo || '';
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
        type: 'bill_payment',
        billerName,
        billerAccountNo,
      },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <TransactionAuthScreen
      title="Confirm Payment"
      summaryLabel="Paying Bill"
      summaryTitle={billerName}
      summarySubtitle={billerAccountNo}
      amount={amount}
      onAuthorized={handleAuthorized}
      onCancel={handleCancel}
      onVerifyPin={handleVerifyPin}
      pinLength={8}
    />
  );
}
