export interface MappedTransaction {
  id: string;
  title: string;
  time: string;
  timestampMs?: number;
  amount: string;
  amountVal: number;
  isOutgoing: boolean;
  status: string;
  statusEnglish: 'Successful' | 'Failed';
  rawStatus: string;
  referenceNo: string;
  errorCode?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  receiver: string;
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

  if (typeLower === 'sent' || typeLower === 'send' || typeLower === 'send_money') {
    isOutgoing = true;
  } else if (typeLower === 'received' || typeLower === 'receive') {
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

  if (typeLower === 'sent' || typeLower === 'send' || typeLower === 'send_money' || typeLower === 'received' || typeLower === 'receive') {
    iconName = isOutgoing ? 'send-outline' : 'arrow-down-outline';
    iconBg = isOutgoing ? primaryLightColor : 'rgba(16, 185, 129, 0.12)';
    iconColor = isOutgoing ? primaryColor : successColor;
    displayTitle = isOutgoing
      ? `${t.sendMoney || 'Send Money'} to ${displayCounterpart}`
      : `${language === 'en' ? 'Receive Money' : 'টাকা গ্রহণ'} from ${displayCounterpart}`;
  } else if (typeLower === 'recharge' || typeLower === 'mobile_recharge') {
    iconName = 'flash-outline';
    iconBg = '#FFF9E6';
    iconColor = '#FF9500';
    displayTitle = `${t.mobileRecharge || 'Mobile Recharge'} (${tx.operator || tx.mobileNumber || ''})`;
  } else if (typeLower === 'bill' || typeLower === 'bill_payment') {
    iconName = 'document-text-outline';
    iconBg = 'rgba(239, 68, 68, 0.12)';
    iconColor = errorColor;
    displayTitle = `${t.billPayment || 'Bill Payment'} (${tx.billerName || ''})`;
  } else {
    iconName = isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline';
    iconBg = isOutgoing ? primaryLightColor : 'rgba(16, 185, 129, 0.12)';
    iconColor = isOutgoing ? primaryColor : successColor;
    displayTitle = isOutgoing
      ? `Payment to ${displayCounterpart}`
      : `Payment from ${displayCounterpart}`;
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
  const amountVal = parseFloat(tx.amount || 0);

  return {
    id: String(tx.id || Math.random()),
    title: displayTitle,
    time: formattedTime,
    timestampMs,
    amount: `${isOutgoing ? '-' : '+'} ৳${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    amountVal,
    isOutgoing,
    status: isTxSuccess
      ? (language === 'en' ? 'Successful' : 'সফল')
      : (language === 'en' ? 'Failed' : 'ব্যর্থ'),
    statusEnglish: isTxSuccess ? 'Successful' : 'Failed',
    rawStatus: tx.status,
    referenceNo: tx.reference || tx.referenceNo || 'N/A',
    errorCode: tx.failure_reason || tx.errorCode,
    icon: iconName,
    iconColor,
    iconBg,
    receiver: displayCounterpart,
  };
}
