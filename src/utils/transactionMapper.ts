export interface MappedTransaction {
  id: string;
  title: string;
  time: string;
  timestampMs?: number;
  amount: string;
  amountVal: number;
  isOutgoing: boolean;
  status: string;
  statusEnglish: 'Successful' | 'Failed' | 'Pending';
  rawStatus: string;
  referenceNo: string;
  errorCode?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  receiver: string;
  isOfflinePending?: boolean;
}

export function mapApiTransaction(
  tx: any,
  currentUsername: string,
  t: any,
  language: 'en' | 'bn',
  theme?: any
): MappedTransaction {
  const primaryColor = theme?.primary || '#583EF2';
  const primaryLightColor = theme?.primaryLight || '#EBE8FF';
  const successColor = theme?.success || '#09C487';
  const errorColor = theme?.error || '#FF3838';

  const sender = (tx.sender_username || tx.sender || '').toLowerCase();
  const receiver = (tx.receiver_username || tx.receiver || '').toLowerCase();

  let isOutgoing = false;
  const typeLower = tx.type?.toLowerCase() || '';

  if (typeLower === 'sent' || typeLower === 'send' || typeLower === 'send_money' || typeLower === 'user_transfer') {
    isOutgoing = true;
  } else if (typeLower === 'received' || typeLower === 'receive' || typeLower === 'receive_money') {
    isOutgoing = false;
  } else if (currentUsername) {
    if (sender === currentUsername) {
      isOutgoing = true;
    } else if (receiver === currentUsername) {
      isOutgoing = false;
    } else {
      isOutgoing = !!sender;
    }
  }

  const counterpart = isOutgoing ? (tx.receiver_username || tx.receiver) : (tx.sender_username || tx.sender);
  const displayCounterpart = counterpart
    ? (counterpart.charAt(0).toUpperCase() + counterpart.slice(1))
    : 'N/A';

  let iconName = 'swap-horizontal-outline';
  let iconBg = primaryLightColor;
  let iconColor = primaryColor;
  let displayTitle = '';

  if (typeLower === 'sent' || typeLower === 'send' || typeLower === 'send_money' || typeLower === 'user_transfer') {
    iconName = 'send-outline';
    iconBg = primaryLightColor;
    iconColor = primaryColor;
    displayTitle = `${t.sendMoney || 'Send Money'} to ${displayCounterpart}`;
  } else if (typeLower === 'received' || typeLower === 'receive' || typeLower === 'receive_money') {
    iconName = 'arrow-down-outline';
    iconBg = 'rgba(16, 185, 129, 0.12)';
    iconColor = successColor;
    displayTitle = `${language === 'en' ? 'Receive Money' : 'টাকা গ্রহণ'} from ${displayCounterpart}`;
  } else if (typeLower === 'recharge' || typeLower === 'mobile_recharge') {
    iconName = 'flash-outline';
    iconBg = '#FFF9E6';
    iconColor = '#FF9500';
    displayTitle = `${t.mobileRecharge || 'Mobile Recharge'} (${tx.operator || tx.mobileNumber || displayCounterpart})`;
  } else if (typeLower === 'bill' || typeLower === 'bill_payment') {
    iconName = 'document-text-outline';
    iconBg = 'rgba(239, 68, 68, 0.12)';
    iconColor = errorColor;
    displayTitle = `${t.billPayment || 'Bill Payment'} (${tx.billerName || displayCounterpart})`;
  } else if (typeLower === 'merchant_payment') {
    iconName = 'storefront-outline';
    iconBg = 'rgba(255, 149, 0, 0.12)';
    iconColor = '#FF9500';
    displayTitle = `${language === 'en' ? 'Merchant Payment' : 'মার্চেন্ট পেমেন্ট'} to ${tx.merchantName || displayCounterpart}`;
  } else if (typeLower === 'qr_payment') {
    iconName = 'qr-code-outline';
    iconBg = primaryLightColor;
    iconColor = primaryColor;
    displayTitle = `${language === 'en' ? 'QR Payment' : 'QR পেমেন্ট'} to ${displayCounterpart}`;
  } else if (typeLower === 'nfc_transfer') {
    iconName = 'wifi-outline';
    iconBg = isOutgoing ? primaryLightColor : 'rgba(16, 185, 129, 0.12)';
    iconColor = isOutgoing ? primaryColor : successColor;
    displayTitle = isOutgoing
      ? `${language === 'en' ? 'NFC Transfer to' : 'NFC ট্রান্সফার:'} ${displayCounterpart}`
      : `${language === 'en' ? 'NFC Transfer from' : 'NFC ট্রান্সফার:'} ${displayCounterpart}`;
  } else if (typeLower === 'security_penalty' || typeLower === 'security_fraud_penalty') {
    iconName = 'shield-outline';
    iconBg = 'rgba(255, 56, 56, 0.15)';
    iconColor = errorColor;
    displayTitle = language === 'en' ? 'Security Penalty' : 'নিরাপত্তা জরিমানা';
  } else {
    iconName = isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline';
    iconBg = isOutgoing ? primaryLightColor : 'rgba(16, 185, 129, 0.12)';
    iconColor = isOutgoing ? primaryColor : successColor;
    displayTitle = isOutgoing
      ? `${language === 'en' ? 'Payment' : 'পেমেন্ট'} to ${displayCounterpart}`
      : `${language === 'en' ? 'Payment' : 'পেমেন্ট'} from ${displayCounterpart}`;
  }

  let formattedTime = tx.created_at || tx.timestamp || 'N/A';
  let timestampMs: number | undefined = undefined;
  if (formattedTime !== 'N/A') {
    try {
      const cleanStr = String(formattedTime).replace('Z', '+00:00');
      const dt = new Date(cleanStr);
      if (!isNaN(dt.getTime())) {
        timestampMs = dt.getTime();
        const day = String(dt.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[dt.getMonth()];
        const year = dt.getFullYear();
        let hours = dt.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strHours = String(hours).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        formattedTime = `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
      }
    } catch (e) {}
  }

  const isTxSuccess = tx.status === 'success' || tx.status === 'Successful';
  // Only an OUTGOING queued transfer counts as "offline pending". Incoming offline
  // receipts (OFF-REC-…) are already-claimed credits and must render normally.
  const localRef = String(tx.reference || tx.id || '');
  const isOfflinePending = localRef.startsWith('OFF-') && !localRef.startsWith('OFF-REC-');
  const isForfeited = tx.status === 'forfeited_no_refund' || tx.status === 'failed_unrefunded';
  const isTxPending = tx.status === 'pending';
  const isTxReversed = tx.status === 'reversed';
  const amountVal = parseFloat(tx.amount || 0);

  let displayStatus: string;
  let displayStatusEnglish: 'Successful' | 'Failed' | 'Pending';

  if (isForfeited) {
    displayStatus = language === 'en' ? 'Non-Refundable' : 'অফেরতযোগ্য';
    displayStatusEnglish = 'Failed';
    iconName = 'alert-circle-outline';
    iconBg = 'rgba(255, 56, 56, 0.15)';
    iconColor = errorColor;
  } else if (isOfflinePending && isTxSuccess) {
    // Queued locally, not yet confirmed by the server — must not be reported as a
    // confirmed success in History.
    displayStatus = language === 'en' ? 'Offline' : 'অফলাইন';
    displayStatusEnglish = 'Pending';
  } else if (isTxSuccess) {
    displayStatus = language === 'en' ? 'Successful' : 'সফল';
    displayStatusEnglish = 'Successful';
  } else if (isTxPending) {
    displayStatus = language === 'en' ? 'Pending' : 'অপেক্ষমাণ';
    displayStatusEnglish = 'Pending';
    iconName = 'time-outline';
    iconBg = 'rgba(255, 149, 0, 0.12)';
    iconColor = '#FF9500';
  } else if (isTxReversed) {
    displayStatus = language === 'en' ? 'Reversed' : 'ফেরত';
    displayStatusEnglish = 'Failed';
    iconName = 'refresh-outline';
    iconBg = 'rgba(255, 56, 56, 0.15)';
    iconColor = errorColor;
  } else {
    displayStatus = language === 'en' ? 'Failed' : 'ব্যর্থ';
    displayStatusEnglish = 'Failed';
  }

  return {
    // Deterministic fallback so React list keys stay stable across re-renders
    // (a Math.random() id remounted every row on each render/sync).
    id: String(
      tx.id ||
        tx.reference ||
        tx.referenceNo ||
        [sender, receiver, amountVal, tx.created_at || tx.createdAt || ''].join('|')
    ),
    title: displayTitle,
    time: formattedTime,
    timestampMs,
    amount: `${isOutgoing ? '-' : '+'} ৳${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    amountVal,
    isOutgoing,
    status: displayStatus,
    statusEnglish: displayStatusEnglish,
    rawStatus: tx.status,
    referenceNo: tx.reference || tx.referenceNo || 'N/A',
    errorCode: tx.failure_reason || tx.errorCode,
    icon: iconName,
    iconColor,
    iconBg,
    receiver: displayCounterpart,
    isOfflinePending,
  };
}
