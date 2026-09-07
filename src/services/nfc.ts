/**
 * NFC P2P Transfer Service
 * Handles NFC data exchange between two devices for offline money transfer.
 * Uses react-native-nfc-manager for NFC operations.
 */

import { Platform, Alert } from 'react-native';

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

/**
 * Check if NFC is available on this device.
 */
export async function isNFCAvailable(): Promise<boolean> {
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
  if (!NfcManager) return;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch (e) {}
  try {
    NfcManager.unregisterTagEvent();
  } catch (e) {}
}

/**
 * Write transfer data via NFC (Sender side).
 * Uses NDEF message to send transfer payload.
 */
export async function writeTransferNDEF(payload: NFCTransferPayload): Promise<boolean> {
  if (!NfcManager || !Ndef) return false;

  try {
    await NfcManager.start();

    // Request NFC tech
    await NfcManager.requestTechnology(NfcTech.Ndef);

    // Create NDEF message from payload
    const payloadBytes = Ndef.encodeMessage([
      Ndef.textRecord(JSON.stringify(payload)),
    ]);

    if (payloadBytes) {
      await NfcManager.ndefHandler.writeNdefMessage(payloadBytes);
      console.log('[NFC] Transfer data written successfully');
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[NFC] Write failed:', e);
    return false;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (e) {}
  }
}

/**
 * Read transfer data via NFC (Receiver side).
 * Listens for NDEF messages and parses transfer payload.
 */
export async function readTransferNDEF(): Promise<NFCTransferPayload | null> {
  if (!NfcManager || !Ndef) return null;

  try {
    await NfcManager.start();

    // Register for tag discovery
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        NfcManager.unregisterTagEvent();
        reject(new Error('NFC read timeout'));
      }, 30000); // 30 second timeout

      NfcManager.registerTagEvent((tag: any) => {
        clearTimeout(timeout);
        NfcManager.unregisterTagEvent();

        try {
          if (tag.ndefMessage && tag.ndefMessage.length > 0) {
            const record = tag.ndefMessage[0];
            if (record.type === Ndef.TNF_WELL_KNOWN && record.payload) {
              const text = Ndef.text.decodePayload(record.payload);
              const payload = JSON.parse(text);

              if (payload.type === 'DPT_P2P_TRANSFER' && payload.version === 1) {
                console.log('[NFC] Transfer data received:', payload);
                resolve(payload);
              } else {
                reject(new Error('Invalid NFC transfer payload'));
              }
            } else {
              reject(new Error('No NDEF text record found'));
            }
          } else {
            reject(new Error('No NDEF message found'));
          }
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  } catch (e) {
    console.warn('[NFC] Read failed:', e);
    return null;
  }
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
