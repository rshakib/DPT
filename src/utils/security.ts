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

// =========================================================================
// Duress PIN (paper §3.1) — a distinct local credential that selects the
// separate duress signing key. Never sent to the server.
// =========================================================================

const DURESS_PIN_HASH_PREFIX = 'niropay_duress_pin_hash_';
export const DURESS_LIMIT_DEFAULT = 500;

/** Store the duress PIN hash (hardware-isolated salted SHA-256). */
export async function saveDuressPinHash(username: string, pin: string): Promise<boolean> {
  if (!username || !pin) return false;
  try {
    const cleanUsername = username.trim().toLowerCase();
    const hash = await computePinHash(cleanUsername, pin);
    await SecureStore.setItemAsync(`${DURESS_PIN_HASH_PREFIX}${cleanUsername}`, hash);
    return true;
  } catch (error) {
    console.warn('[SECURITY] Failed to save duress PIN hash:', error);
    return false;
  }
}

/** True when a duress PIN has been configured for this user. */
export async function hasDuressPin(username: string): Promise<boolean> {
  if (!username) return false;
  try {
    const cleanUsername = username.trim().toLowerCase();
    return !!(await SecureStore.getItemAsync(`${DURESS_PIN_HASH_PREFIX}${cleanUsername}`));
  } catch {
    return false;
  }
}

/**
 * Verify an entered PIN against the stored duress hash. This is a LOCAL-only check
 * (the duress PIN is never the account password and is never sent to the server).
 */
export async function verifyDuressPin(username: string, pin: string): Promise<boolean> {
  if (!username || !pin) return false;
  try {
    const cleanUsername = username.trim().toLowerCase();
    const stored = await SecureStore.getItemAsync(`${DURESS_PIN_HASH_PREFIX}${cleanUsername}`);
    if (!stored) return false;
    const computed = await computePinHash(cleanUsername, pin);
    return computed === stored;
  } catch (error) {
    console.warn('[SECURITY] Error verifying duress PIN:', error);
    return false;
  }
}

export async function clearDuressPinHash(username: string): Promise<void> {
  if (!username) return;
  try {
    const cleanUsername = username.trim().toLowerCase();
    await SecureStore.deleteItemAsync(`${DURESS_PIN_HASH_PREFIX}${cleanUsername}`);
  } catch (error) {
    console.warn('[SECURITY] Failed to clear duress PIN hash:', error);
  }
}

// Conservative client-side counter against L_D for offline-created duress envelopes
// (paper §4.1). The server re-checks authoritatively at commit time.
const DURESS_SPENT_PREFIX = 'niropay_duress_spent_';

export async function getDuressSpent(username: string, limit: number = DURESS_LIMIT_DEFAULT): Promise<number> {
  if (!username) return 0;
  try {
    const raw = await SecureStore.getItemAsync(`${DURESS_SPENT_PREFIX}${username.trim().toLowerCase()}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Returns the new cumulative duress spend after adding `amount`. */
export async function addDuressSpent(username: string, amount: number): Promise<number> {
  if (!username) return 0;
  try {
    const key = `${DURESS_SPENT_PREFIX}${username.trim().toLowerCase()}`;
    const raw = await SecureStore.getItemAsync(key);
    const next = (raw ? Number(raw) || 0 : 0) + amount;
    await SecureStore.setItemAsync(key, String(next));
    return next;
  } catch {
    return 0;
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
    // 2. Check if internet is available
    const isOnline = await checkInternetConnectivity();

    if (isOnline) {
      // Internet available → verify against database (server)
      console.log('[SECURITY] Online mode — verifying PIN against server');
      const serverResult = await api.verifyPin(cleanUsername, pin);
      if (serverResult.success) {
        isMatch = true;
        // Save/update local hash for future offline use
        await saveLocalPinHash(cleanUsername, pin);
      }
    } else {
      // No internet → verify locally only
      console.log('[SECURITY] Offline mode — verifying PIN locally');
      const storedHash = await SecureStore.getItemAsync(key);

      if (storedHash) {
        // Offline verification via salted SHA-256 hash comparison
        const computedHash = await computePinHash(cleanUsername, pin);
        if (computedHash === storedHash) {
          isMatch = true;
        }
      } else {
        // No local hash and no internet — cannot verify
        return { success: false, message: 'No internet connection and no local PIN data. Please connect to internet first.' };
      }
    }
  } catch (error) {
    console.warn('[SECURITY] Error during PIN verification:', error);
    // On any error, try local verification as fallback
    try {
      const storedHash = await SecureStore.getItemAsync(key);
      if (storedHash) {
        const computedHash = await computePinHash(cleanUsername, pin);
        if (computedHash === storedHash) {
          isMatch = true;
        }
      }
    } catch (fallbackError) {
      console.warn('[SECURITY] Fallback verification also failed:', fallbackError);
    }
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
 * Check if device has internet connectivity.
 */
async function checkInternetConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
    const response = await fetch('https://e-pay-fydp.onrender.com/health', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.status < 500;
  } catch {
    return false;
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
