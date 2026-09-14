/**
 * NFC P2P Transfer Service
 * Handles NFC data exchange between two devices for offline money transfer.
 * Uses react-native-nfc-manager for NFC operations.
 */

import { Platform, Alert, NativeModules, NativeEventEmitter } from 'react-native';

const { DptHceModule } = NativeModules;
const hceEventEmitter = DptHceModule ? new NativeEventEmitter(DptHceModule) : null;

// Dynamic import — will be null if package not installed
let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;

try {
  const nfc = require('react-native-nfc-manager');
  NfcManager = nfc.default;
  NfcTech = nfc.NfcTech;
  Ndef = nfc.Ndef;
} catch (e) {
  console.warn('[NFC] react-native-nfc-manager not installed');
}

export interface NFCTransferPayload {
  type: 'DPT_P2P_TRANSFER';
  version: 1;
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  txid: string;
  nonce: string;
}

// P0 FIX: Always send full payload format for consistency between native and JS
export function toCompactNfcPayload(payload: NFCTransferPayload): string {
  return JSON.stringify(payload);
}

export function fromNfcPayload(raw: any): NFCTransferPayload | null {
  if (!raw) return null;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  // Accept full format
  if (obj?.type === 'DPT_P2P_TRANSFER') {
    return obj as NFCTransferPayload;
  }
  // Accept compact format (backward compatibility)
  if (obj?.t === 'DPT') {
    return {
      type: 'DPT_P2P_TRANSFER',
      version: obj.v || 1,
      sender: obj.s || '',
      receiver: obj.r || '',
      amount: Number(obj.a || 0),
      timestamp: obj.m || new Date().toISOString(),
      txid: obj.i || '',
      nonce: obj.n || '',
    };
  }
  return null;
}

// P1 FIX: Validate incoming NFC payload on receiver side
export function validateNfcPayload(payload: NFCTransferPayload): { valid: boolean; error?: string } {
  if (!payload) {
    return { valid: false, error: 'Empty payload' };
  }
  if (payload.type !== 'DPT_P2P_TRANSFER') {
    return { valid: false, error: 'Invalid payload type' };
  }
  if (!payload.sender || payload.sender.length < 1) {
    return { valid: false, error: 'Missing sender' };
  }
  if (!payload.amount || payload.amount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }
  if (!payload.txid || payload.txid.length < 1) {
    return { valid: false, error: 'Missing transaction ID' };
  }
  if (!payload.nonce || payload.nonce.length < 1) {
    return { valid: false, error: 'Missing nonce' };
  }
  return { valid: true };
}

export function isDptHceModuleAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(DptHceModule);
}

// Custom DPT Application Identifier (AID): F0010203040506 (7 bytes)
const AID_SELECT_COMMAND = [
  0x00, // CLA
  0xA4, // INS (SELECT)
  0x04, // P1 (Select by name / AID)
  0x00, // P2 (First or only occurrence)
  0x07, // Lc (Length of AID = 7)
  0xF0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, // AID bytes
  0x00, // Le
];

function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push((code >> 6) | 192);
      bytes.push((code & 63) | 128);
    } else {
      bytes.push((code >> 12) | 224);
      bytes.push(((code >> 6) & 63) | 128);
      bytes.push((code & 63) | 128);
    }
  }
  return bytes;
}

function bytesToString(bytes: number[]): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 128) {
      result += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      const c2 = bytes[i++];
      result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      result += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    }
  }
  return result;
}

/**
 * Activate Native Host Card Emulation (HCE) on Receiver device.
 */
export async function startHceReceiver(username: string): Promise<boolean> {
  if (Platform.OS === 'android' && DptHceModule?.setReceiverActive) {
    try {
      await DptHceModule.setReceiverActive(username, true);
      console.log('[NFC-HCE] Native card emulation active for @' + username);
      return true;
    } catch (e) {
      console.warn('[NFC-HCE] Failed to activate native HCE receiver:', e);
      return false;
    }
  }
  return false;
}

/**
 * Deactivate Native Host Card Emulation (HCE).
 */
export async function stopHceReceiver(): Promise<void> {
  if (Platform.OS === 'android' && DptHceModule?.setReceiverActive) {
    try {
      await DptHceModule.setReceiverActive('', false);
      console.log('[NFC-HCE] Native card emulation deactivated');
    } catch (e) {
      console.warn('[NFC-HCE] Failed to deactivate HCE receiver:', e);
    }
  }
}

/**
 * Actively pop any buffered payment received via HCE.
 */
export async function popReceivedPayment(): Promise<NFCTransferPayload | null> {
  if (Platform.OS === 'android' && DptHceModule?.popLatestReceivedPayment) {
    try {
      const rawJson = await DptHceModule.popLatestReceivedPayment();
      if (rawJson) {
        console.log('[NFC-HCE] Retrieved buffered payment via pop:', rawJson);
        return fromNfcPayload(rawJson);
      }
    } catch (e) {
      console.warn('[NFC-HCE] Error popping received payment:', e);
    }
  }
  return null;
}

/**
 * Subscribe to incoming NFC payment transmitted via HCE from sender.
 */
export function subscribeHcePayment(
  callback: (payload: NFCTransferPayload) => void
): { unsubscribe: () => void } {
  if (!hceEventEmitter) {
    return { unsubscribe: () => {} };
  }

  const subscription = hceEventEmitter.addListener(
    'onNfcHcePaymentReceived',
    (event: { payload: string }) => {
      try {
        const rawJson = typeof event?.payload === 'string' ? event.payload : JSON.stringify(event);
        const parsed = fromNfcPayload(rawJson);
        if (parsed) {
          console.log('[NFC-HCE] Incoming payment received via HCE event:', parsed);
          callback(parsed);
        }
      } catch (err) {
        console.error('[NFC-HCE] Error parsing incoming HCE payment payload:', err);
      }
    }
  );

  return {
    unsubscribe: () => {
      try {
        subscription.remove();
      } catch (_) {}
    },
  };
}

/**
 * Send money phone-to-phone via ISO-DEP APDUs (Sender side).
 */
export async function sendIsoDepPayment(
  payload: NFCTransferPayload
): Promise<{ success: boolean; receiver: string }> {
  // Method 1: High-speed native Android ReaderMode
  if (Platform.OS === 'android' && DptHceModule?.sendPaymentNative) {
    try {
      console.log('[NFC-IsoDep] Initiating native high-speed ReaderMode...');
      // P0 FIX: Send full payload format for consistency
      const fullJson = JSON.stringify(payload);
      const result = await DptHceModule.sendPaymentNative(fullJson);
      console.log('[NFC-IsoDep] Native payment result:', result);
      return {
        success: Boolean(result?.success),
        receiver: result?.receiver || payload.receiver || 'receiver',
      };
    } catch (nativeErr: any) {
      console.warn('[NFC-IsoDep] Native ReaderMode error:', nativeErr);
      throw nativeErr;
    }
  }

  // Method 2: Fallback via react-native-nfc-manager
  if (!NfcManager) {
    throw new Error('NFC is not available on this device.');
  }

  try {
    await NfcManager.start();

    console.log('[NFC-IsoDep] Requesting IsoDep technology via NfcManager...');
    await NfcManager.requestTechnology(NfcTech.IsoDep, {
      alertMessage: 'Hold phones back-to-back',
    });

    // Step 1: Send SELECT AID APDU
    console.log('[NFC-IsoDep] Transceiving SELECT AID command...');
    const selectResponse: number[] = await NfcManager.isoDepHandler.transceive(AID_SELECT_COMMAND);
    console.log('[NFC-IsoDep] SELECT response:', selectResponse);

    if (!selectResponse || selectResponse.length < 2) {
      throw new Error('No response from receiver phone. Make sure receiver is on the Receive screen.');
    }

    const sw1 = selectResponse[selectResponse.length - 2];
    const sw2 = selectResponse[selectResponse.length - 1];

    if (sw1 !== 0x90 || sw2 !== 0x00) {
      throw new Error('Receiver phone is not in active receive mode.');
    }

    // Parse receiver identity from response body
    let detectedReceiver = payload.receiver || '';
    if (selectResponse.length > 2) {
      try {
        const bodyBytes = selectResponse.slice(0, selectResponse.length - 2);
        const bodyStr = bytesToString(bodyBytes);
        const parsed = JSON.parse(bodyStr);
        if (parsed?.receiver) {
          detectedReceiver = parsed.receiver;
        }
      } catch (_) {}
    }

    // Step 2: Send payment payload APDU
    const finalPayload = { ...payload, receiver: detectedReceiver || payload.receiver };
    const payloadBytes = stringToBytes(JSON.stringify(finalPayload));

    const paymentApdu = [
      0x80, // CLA
      0xB0, // INS (PROCESS_PAYMENT)
      0x00, // P1
      0x00, // P2
      payloadBytes.length, // Lc
      ...payloadBytes,
    ];

    console.log('[NFC-IsoDep] Transceiving Payment APDU (' + payloadBytes.length + ' bytes)...');
    const paymentResponse: number[] = await NfcManager.isoDepHandler.transceive(paymentApdu);
    console.log('[NFC-IsoDep] Payment response:', paymentResponse);

    if (!paymentResponse || paymentResponse.length < 2) {
      throw new Error('Payment transmission failed: no confirmation from receiver.');
    }

    const paySw1 = paymentResponse[paymentResponse.length - 2];
    const paySw2 = paymentResponse[paymentResponse.length - 1];

    if (paySw1 === 0x90 && paySw2 === 0x00) {
      return { success: true, receiver: detectedReceiver };
    } else {
      throw new Error('Receiver rejected the payment payload.');
    }
  } catch (err: any) {
    console.warn('[NFC-IsoDep] Payment failed:', err);
    throw err;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (_) {}
  }
}

/**
 * Cancel active ISO-DEP reader session.
 */
export async function cancelIsoDepPayment(): Promise<void> {
  if (Platform.OS === 'android' && DptHceModule?.cancelSendPayment) {
    try {
      await DptHceModule.cancelSendPayment();
    } catch (_) {}
  }
  if (NfcManager) {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (_) {}
  }
}

/**
 * Check if NFC is available on this device.
 */
export async function isNFCAvailable(): Promise<boolean> {
  if (Platform.OS === 'android' && DptHceModule?.isNfcEnabled) {
    try {
      const enabled = await DptHceModule.isNfcEnabled();
      if (enabled) return true;
    } catch (_) {}
  }
  if (!NfcManager) return false;
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return false;
    await NfcManager.start();
    return true;
  } catch (e) {
    console.warn('[NFC] Not available:', e);
    return false;
  }
}

/**
 * Stop NFC manager.
 */
export async function stopNFC(): Promise<void> {
  await cancelIsoDepPayment();
  if (!NfcManager) return;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch (e) {}
  try {
    NfcManager.unregisterTagEvent();
  } catch (e) {}
}

/**
 * Generate a unique transfer ID for NFC P2P transfers.
 */
export function generateNFCTransferId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 100000);
  return `NFC-${timestamp}-${random}`;
}

/**
 * Generate a random nonce for freshness.
 */
export function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
