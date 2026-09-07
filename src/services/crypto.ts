/**
 * RSA Key Generation and Signing for DPT Mobile App
 * Uses node-forge (pure JS, no native modules needed) for RSA-2048 operations.
 * Private key is stored in SecureStore (non-exportable via Android Keystore in future).
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const RSA_PRIVATE_KEY_ALIAS = 'dpt_rsa_private_key';
const RSA_PUBLIC_KEY_ALIAS = 'dpt_rsa_public_key';

/**
 * Generate RSA-2048 key pair.
 * Returns the public key PEM to send to server during registration.
 * Private key is stored in SecureStore.
 * 
 * NOTE: This is a JS-based implementation. For production with Android Keystore/StrongBox
 * (non-exportable keys), use react-native-rsa-native with a custom dev client.
 */
export async function generateRSAKeyPair(): Promise<{ publicKeyPem: string; success: boolean }> {
  try {
    // Use node-forge for pure JS RSA key generation
    // Dynamic import to avoid blocking app startup
    const forge = require('node-forge');

    return new Promise((resolve) => {
      // Generate RSA-2048 key pair (runs in background to avoid blocking UI)
      forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err: any, keypair: any) => {
        if (err) {
          console.warn('[CRYPTO] RSA key generation failed:', err);
          resolve({ publicKeyPem: '', success: false });
          return;
        }

        try {
          const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
          const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);

          // Store keys in SecureStore
          SecureStore.setItemAsync(RSA_PRIVATE_KEY_ALIAS, privateKeyPem).catch((e) =>
            console.warn('[CRYPTO] Failed to store private key:', e)
          );
          SecureStore.setItemAsync(RSA_PUBLIC_KEY_ALIAS, publicKeyPem).catch((e) =>
            console.warn('[CRYPTO] Failed to store public key:', e)
          );

          console.log('[CRYPTO] RSA-2048 key pair generated successfully');
          resolve({ publicKeyPem, success: true });
        } catch (e) {
          console.warn('[CRYPTO] Key processing failed:', e);
          resolve({ publicKeyPem: '', success: false });
        }
      });
    });
  } catch (e) {
    console.warn('[CRYPTO] node-forge not available, skipping RSA key generation:', e);
    return { publicKeyPem: '', success: false };
  }
}

/**
 * Get the stored public key PEM (if previously generated).
 */
export async function getStoredPublicKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(RSA_PUBLIC_KEY_ALIAS);
  } catch {
    return null;
  }
}

/**
 * Check if RSA keys have been generated.
 */
export async function hasRSAKeys(): Promise<boolean> {
  try {
    const key = await SecureStore.getItemAsync(RSA_PUBLIC_KEY_ALIAS);
    return !!key;
  } catch {
    return false;
  }
}
