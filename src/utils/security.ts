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

/**
 * Verifies a PIN locally using hardware SecureStore (0ms latency, 100% offline).
 * If no local hash exists, falls back to server verification and saves the local hash on success.
 */
export async function verifyPinLocally(
  username: string,
  pin: string
): Promise<{ success: boolean; message?: string }> {
  if (!username || !pin) {
    return { success: false, message: 'Missing username or PIN' };
  }

  const cleanUsername = username.trim().toLowerCase();
  const key = `${PIN_HASH_PREFIX}${cleanUsername}`;

  try {
    const storedHash = await SecureStore.getItemAsync(key);

    if (storedHash) {
      // Offline verification via salted SHA-256 hash comparison
      const computedHash = await computePinHash(cleanUsername, pin);
      if (computedHash === storedHash) {
        return { success: true };
      } else {
        return { success: false, message: 'Invalid PIN' };
      }
    }
  } catch (error) {
    console.warn('[SECURITY] Error reading local PIN hash, falling back to server verification:', error);
  }

  // Fallback to online server verification if local hash is missing or on error
  const serverResult = await api.verifyPin(cleanUsername, pin);
  if (serverResult.success) {
    // Cache the hash locally for future offline verifications
    await saveLocalPinHash(cleanUsername, pin);
    return { success: true };
  } else {
    return { success: false, message: serverResult.message || 'Invalid PIN' };
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
