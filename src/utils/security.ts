import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as api from '../services/api';

const PIN_HASH_PREFIX = 'niropay_pin_hash_';

/**
 * Computes a salted SHA-256 hash of the username and PIN.
 */
export async function computePinHash(username: string, pin: string): Promise<string> {
  const cleanUsername = username.trim().toLowerCase();
  const saltedInput = `niropay_salt_v1_${cleanUsername}_${pin}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltedInput
  );
  return hash;
}

/**
 * Saves the computed salted PIN hash securely to hardware SecureStore.
 */
export async function saveLocalPinHash(username: string, pin: string): Promise<void> {
  if (!username || !pin) return;
  try {
    const cleanUsername = username.trim().toLowerCase();
    const hash = await computePinHash(cleanUsername, pin);
    await SecureStore.setItemAsync(`${PIN_HASH_PREFIX}${cleanUsername}`, hash);
  } catch (error) {
    console.warn('[SECURITY] Failed to save local PIN hash to SecureStore:', error);
  }
}

const PIN_ATTEMPTS_PREFIX = 'niropay_pin_attempts_';
const PIN_LOCKOUT_PREFIX = 'niropay_pin_lockout_';
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface PinLockoutStatus {
  isLocked: boolean;
  remainingMinutes: number;
  message?: string;
}

/**
 * Checks if PIN authentication is currently locked out for a given username.
 */
export async function getPinLockoutStatus(username: string): Promise<PinLockoutStatus> {
  if (!username) return { isLocked: false, remainingMinutes: 0 };
  const cleanUsername = username.trim().toLowerCase();
  const lockoutKey = `${PIN_LOCKOUT_PREFIX}${cleanUsername}`;
  const attemptsKey = `${PIN_ATTEMPTS_PREFIX}${cleanUsername}`;

  try {
    const lockoutUntilStr = await SecureStore.getItemAsync(lockoutKey);
    if (lockoutUntilStr) {
      const lockoutUntil = Number(lockoutUntilStr);
      const now = Date.now();
      if (now < lockoutUntil) {
        const remainingMinutes = Math.max(1, Math.ceil((lockoutUntil - now) / 60000));
        return {
          isLocked: true,
          remainingMinutes,
          message: `Too many incorrect PIN attempts. PIN authentication is locked for 15 minutes. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
        };
      } else {
        // Lockout expired - clean up lock state
        await SecureStore.deleteItemAsync(lockoutKey);
        await SecureStore.deleteItemAsync(attemptsKey);
      }
    }
  } catch (error) {
    console.warn('[SECURITY] Error checking PIN lockout status:', error);
  }

  return { isLocked: false, remainingMinutes: 0 };
}

/**
 * Records a failed PIN attempt and locks authentication if 3 consecutive failures occur.
 */
async function recordFailedPinAttempt(cleanUsername: string): Promise<string> {
  const lockoutKey = `${PIN_LOCKOUT_PREFIX}${cleanUsername}`;
  const attemptsKey = `${PIN_ATTEMPTS_PREFIX}${cleanUsername}`;

  try {
    const currentAttemptsStr = await SecureStore.getItemAsync(attemptsKey);
    const currentAttempts = currentAttemptsStr ? Number(currentAttemptsStr) : 0;
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      await SecureStore.setItemAsync(lockoutKey, String(lockoutUntil));
      await SecureStore.setItemAsync(attemptsKey, String(MAX_FAILED_ATTEMPTS));
      return 'Too many incorrect PIN attempts. PIN authentication is locked for 15 minutes.';
    } else {
      await SecureStore.setItemAsync(attemptsKey, String(newAttempts));
      const remainingAttempts = MAX_FAILED_ATTEMPTS - newAttempts;
      return `Invalid PIN. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`;
    }
  } catch (error) {
    console.warn('[SECURITY] Error recording failed PIN attempt:', error);
    return 'Invalid PIN';
  }
}

/**
 * Resets the failed attempt counter and clears lockout status for a username.
 */
export async function resetPinLockout(username: string): Promise<void> {
  if (!username) return;
  const cleanUsername = username.trim().toLowerCase();
  const lockoutKey = `${PIN_LOCKOUT_PREFIX}${cleanUsername}`;
  const attemptsKey = `${PIN_ATTEMPTS_PREFIX}${cleanUsername}`;

  try {
    await SecureStore.deleteItemAsync(attemptsKey);
    await SecureStore.deleteItemAsync(lockoutKey);
  } catch (error) {
    console.warn('[SECURITY] Error resetting PIN lockout state:', error);
  }
}

/**
 * Verifies a PIN locally using hardware SecureStore (0ms latency, 100% offline).
 * If no local hash exists, falls back to server verification and saves the local hash on success.
 * Enforces 3-strike 15-minute brute-force lockout persisted in SecureStore.
 */
export async function verifyPinLocally(
  username: string,
  pin: string
): Promise<{ success: boolean; message?: string }> {
  if (!username || !pin) {
    return { success: false, message: 'Missing username or PIN' };
  }

  const cleanUsername = username.trim().toLowerCase();

  // 1. Enforce PIN Lockout Check BEFORE performing verification
  const lockoutStatus = await getPinLockoutStatus(cleanUsername);
  if (lockoutStatus.isLocked) {
    return { success: false, message: lockoutStatus.message };
  }

  const key = `${PIN_HASH_PREFIX}${cleanUsername}`;
  let isMatch = false;

  try {
    const storedHash = await SecureStore.getItemAsync(key);

    if (storedHash) {
      // Offline verification via salted SHA-256 hash comparison
      const computedHash = await computePinHash(cleanUsername, pin);
      if (computedHash === storedHash) {
        isMatch = true;
      }
    } else {
      // Fallback to online server verification if local hash is missing or on error
      const serverResult = await api.verifyPin(cleanUsername, pin);
      if (serverResult.success) {
        await saveLocalPinHash(cleanUsername, pin);
        isMatch = true;
      }
    }
  } catch (error) {
    console.warn('[SECURITY] Error during PIN verification:', error);
  }

  if (isMatch) {
    // Correct PIN: Reset failed attempt counter and clear lock state
    await resetPinLockout(cleanUsername);
    return { success: true };
  } else {
    // Incorrect PIN: Record failed attempt and trigger 15-minute lockout on 3rd failure
    const errorMsg = await recordFailedPinAttempt(cleanUsername);
    return { success: false, message: errorMsg };
  }
}

/**
 * Removes local stored PIN hash (used on account deletion / reset).
 */
export async function clearLocalPinHash(username: string): Promise<void> {
  if (!username) return;
  try {
    const cleanUsername = username.trim().toLowerCase();
    await SecureStore.deleteItemAsync(`${PIN_HASH_PREFIX}${cleanUsername}`);
  } catch (error) {
    console.warn('[SECURITY] Failed to clear local PIN hash:', error);
  }
}

/**
 * Generates an RFC 4122 compliant UUID v4 string for transaction idempotency keys.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
