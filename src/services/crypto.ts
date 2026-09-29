/**
 * Hybrid Transaction Envelope (HTE) Cryptography for DPT Mobile App
 * Implements the research paper specification:
 * - NIST P-256 Ephemeral-Static ECDH key establishment
 * - HKDF-SHA256 key derivation with context-bound salt & info
 * - AES-256-GCM authenticated encryption for payment payload
 * - Device-bound NIST P-256 ECDSA digital signatures (biometric-gated)
 * 
 * Powered by audited @noble/curves, @noble/hashes, and @noble/ciphers.
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { NativeModules } from 'react-native';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { gcm } from '@noble/ciphers/aes';

// ---------------------------------------------------------------------------
// React Native / Hermes does not define a global `crypto.getRandomValues`,
// which @noble/* (P-256 key generation) requires. Polyfill it from expo-crypto
// (a real CSPRNG) — without this, device key generation throws
// "crypto.getRandomValues must be defined".
// ---------------------------------------------------------------------------
const _globalCrypto: any = globalThis as any;
if (!_globalCrypto.crypto) {
  _globalCrypto.crypto = {};
}
if (typeof _globalCrypto.crypto.getRandomValues !== 'function') {
  _globalCrypto.crypto.getRandomValues = (arr: any) => {
    const bytes = Crypto.getRandomBytes(arr.byteLength);
    new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength).set(bytes);
    return arr;
  };
}

// Native Android Keystore bridge (non-exportable device key, paper §2).
// Absent on iOS/web or builds without the module -> software fallback is used.
const { DptKeystoreModule } = NativeModules;
const DEVICE_KEYSTORE_ALIAS = 'dpt_device_ecdsa_keystore_v1';
const DEVICE_KEYSTORE_ALIAS_DURESS = 'dpt_device_ecdsa_keystore_duress_v1';

const DEVICE_ECDSA_PRIVATE_KEY_ALIAS = 'dpt_device_ecdsa_private_key';
const DEVICE_ECDSA_PUBLIC_KEY_ALIAS = 'dpt_device_ecdsa_public_key';
const DEVICE_ECDSA_DURESS_PRIVATE_ALIAS = 'dpt_device_ecdsa_duress_private_key';
const DEVICE_ECDSA_DURESS_PUBLIC_ALIAS = 'dpt_device_ecdsa_duress_public_key';

// Which keystore/software aliases to use for the normal vs duress signing key.
function keyAliases(duress: boolean) {
  return duress
    ? { ks: DEVICE_KEYSTORE_ALIAS_DURESS, priv: DEVICE_ECDSA_DURESS_PRIVATE_ALIAS, pub: DEVICE_ECDSA_DURESS_PUBLIC_ALIAS }
    : { ks: DEVICE_KEYSTORE_ALIAS, priv: DEVICE_ECDSA_PRIVATE_KEY_ALIAS, pub: DEVICE_ECDSA_PUBLIC_KEY_ALIAS };
}

// Helper: base64-encode raw bytes for the native sign() bridge (standard alphabet).
const _B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += _B64[b0 >> 2];
    out += _B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? _B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? _B64[b2 & 63] : '=';
  }
  return out;
}

// Legacy RSA aliases for backward compatibility
const RSA_PRIVATE_KEY_ALIAS = 'dpt_rsa_private_key';
const RSA_PUBLIC_KEY_ALIAS = 'dpt_rsa_public_key';

// Helper: Convert Uint8Array or Buffer to hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert hex string to Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

// =========================================================================
// 1. Device P-256 ECDSA Key Management (Enrolled at Registration)
// =========================================================================

export interface DeviceKeyResult {
  publicKeyHex: string;
  success: boolean;
}

/** Software fallback: generate a NIST P-256 ECDSA key pair in SecureStore. */
async function generateSoftwareDeviceKey(duress = false): Promise<DeviceKeyResult> {
  try {
    const a = keyAliases(duress);
    const keyPair = p256.keygen();
    const privHex = bytesToHex(keyPair.secretKey);
    // 65-byte uncompressed public key: 0x04 || X || Y
    const pubUncompressed = p256.getPublicKey(keyPair.secretKey, false);
    const pubHex = bytesToHex(pubUncompressed);

    await SecureStore.setItemAsync(a.priv, privHex);
    await SecureStore.setItemAsync(a.pub, pubHex);

    console.log(`[CRYPTO] Generated & saved software device P-256 ECDSA key pair (${duress ? 'duress' : 'normal'})`);
    return { publicKeyHex: pubHex, success: true };
  } catch (error) {
    console.warn('[CRYPTO] Failed to generate device ECDSA key pair:', error);
    return { publicKeyHex: '', success: false };
  }
}

/**
 * Enroll the device signing key.
 *
 * Paper §2: prefers a NON-EXPORTABLE hardware key in Android Keystore/StrongBox
 * (biometric-gated). Falls back to a software SecureStore key when the native
 * module is unavailable (iOS/web/build without the module) so the app keeps working.
 * The returned public key is sent to the server at registration.
 */
export async function generateDeviceECDSAKeyPair(duress = false): Promise<DeviceKeyResult> {
  const a = keyAliases(duress);
  if (DptKeystoreModule?.generateKey) {
    try {
      const pubHex = await DptKeystoreModule.generateKey(a.ks, true);
      if (pubHex && typeof pubHex === 'string') {
        await SecureStore.setItemAsync(a.pub, pubHex).catch(() => {});
        console.log(`[CRYPTO] Enrolled hardware (Android Keystore) ${duress ? 'duress ' : ''}device key`);
        return { publicKeyHex: pubHex, success: true };
      }
    } catch (e) {
      console.warn('[CRYPTO] Keystore enrollment unavailable, using software key:', e);
    }
  }
  return generateSoftwareDeviceKey(duress);
}

/**
 * Sign the canonical envelope bytes with the device key (paper §2/§3).
 * - Hardware path: the private key never leaves the keystore. On failure it THROWS
 *   (so the caller degrades to a non-HTE transfer) — it never signs with a
 *   different key, which would break server verification.
 * - Software path: noble P-256 ECDSA over SHA-256.
 */
export async function signWithDeviceKey(data: Uint8Array, duress = false): Promise<string> {
  const a = keyAliases(duress);
  if (DptKeystoreModule?.hasKey) {
    let has = false;
    try {
      has = await DptKeystoreModule.hasKey(a.ks);
    } catch {
      has = false;
    }
    if (has) {
      const sigHex = await DptKeystoreModule.sign(a.ks, bytesToBase64(data));
      if (!sigHex || typeof sigHex !== 'string') {
        throw new Error('Keystore signing returned no signature');
      }
      return sigHex;
    }
  }

  let privHex = await getStoredDeviceECDSAPrivateKey(duress);
  if (!privHex) {
    await generateSoftwareDeviceKey(duress);
    privHex = await getStoredDeviceECDSAPrivateKey(duress);
  }
  if (!privHex) throw new Error('Unable to access device signing key');
  return bytesToHex(p256.sign(data, hexToBytes(privHex)));
}

/**
 * Retrieve the enrolled device ECDSA public key hex (65 bytes uncompressed).
 */
export async function getStoredDeviceECDSAPublicKey(duress = false): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(keyAliases(duress).pub);
  } catch {
    return null;
  }
}

/**
 * Retrieve the enrolled device ECDSA private key hex (32 bytes).
 */
export async function getStoredDeviceECDSAPrivateKey(duress = false): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(keyAliases(duress).priv);
  } catch {
    return null;
  }
}

/**
 * Check if the device has enrolled ECDSA keys.
 */
export async function hasDeviceECDSAKeys(duress = false): Promise<boolean> {
  try {
    const a = keyAliases(duress);
    const pub = await SecureStore.getItemAsync(a.pub);
    const priv = await SecureStore.getItemAsync(a.priv);
    if (pub && priv) return true;
    // Hardware keystore key: public stored in SecureStore, private is non-exportable.
    if (duress && DptKeystoreModule?.hasKey) {
      return !!(await DptKeystoreModule.hasKey(DEVICE_KEYSTORE_ALIAS_DURESS)) || !!pub;
    }
    return false;
  } catch {
    return false;
  }
}

// =========================================================================
// 2. Hybrid Transaction Envelope (HTE) Construction
// =========================================================================

export interface HTEEnvelopePackage {
  v: number;
  KeyID: string;
  AAD: {
    v: number;
    S: string;
    T: string;
    N: string;
    TxID: string;
    KeyID: string;
    ePK: string;
  };
  ePK: string;
  IV: string;
  C: string;
  Tag: string;
  Sig: string;
}

export interface CreateHTEParams {
  sender: string;
  receiver: string;
  amount: number;
  txid: string;
  serverPublicKeyHex: string;
  keyId?: string;
  timestamp?: string;
  nonce?: string;
  /** When true, sign with the duress key (paper §3.1). Envelope format is unchanged. */
  duress?: boolean;
}

/**
 * Construct a Hybrid Transaction Envelope (HTE) following the research paper:
 * 1. Build payment message M = {S, R, A, T, N, TxID}
 * 2. Generate ephemeral P-256 ECDH pair (esk, ePK)
 * 3. Shared secret Z = ECDH(esk, PK_B^dh)
 * 4. salt = SHA256(HTE-v1-salt || S || TxID || N)
 * 5. info = HTE-v1/AES-256-GCM || T || ePK || KeyID
 * 6. KT = HKDF-Expand(HKDF-Extract(salt, Z), info, 32)
 * 7. AES-256-GCM encryption of M with AAD -> (C, Tag)
 * 8. Biometric-authorized ECDSA-SHA256 signature -> Sig
 * 9. Returns immutable package P = {v, KeyID, AAD, ePK, IV, C, Tag, Sig}
 */
export async function createHybridTransactionEnvelope(
  params: CreateHTEParams
): Promise<HTEEnvelopePackage | null> {
  try {
    const {
      sender,
      receiver,
      amount,
      txid,
      serverPublicKeyHex,
      keyId = 'hte-bank-ecdh-v1',
      timestamp = new Date().toISOString(),
      nonce = `n-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      duress = false,
    } = params;

    const v = 1;
    const S = sender.trim().toLowerCase();
    const R = receiver.trim().toLowerCase();
    const A = amount;
    const T = timestamp;
    const N = nonce;
    const TxID = txid;
    const KeyID = keyId;

    // 1. Payment message M
    const M_obj = { S, R, A, T, N, TxID };
    const M_bytes = new TextEncoder().encode(JSON.stringify(M_obj));

    // 2. Generate fresh ephemeral P-256 ECDH pair (esk, ePK)
    const ephemeralKey = p256.keygen();
    // Compressed SEC1 point (33 bytes: 0x02/0x03 || X) — paper §5's ~125-byte overhead
    // assumes compressed encoding. The server accepts compressed or uncompressed
    // (cryptography from_encoded_point), so both encode the same point.
    const ePK_bytes = p256.getPublicKey(ephemeralKey.secretKey, true); // 33 bytes compressed
    const ePK_hex = bytesToHex(ePK_bytes);

    // 3. Compute shared secret Z = ECDH(esk, PK_B^dh)
    const serverPubBytes = hexToBytes(serverPublicKeyHex);
    const sharedPoint = p256.getSharedSecret(ephemeralKey.secretKey, serverPubBytes, false);
    const Z = sharedPoint.slice(1, 33); // 32-byte X-coordinate

    // 4. salt = SHA256(HTE-v1-salt || S || TxID || N)
    const saltInput = new TextEncoder().encode(`HTE-v1-salt${S}${TxID}${N}`);
    const salt = sha256(saltInput);

    // 5. info = HTE-v1/AES-256-GCM || T || ePK || KeyID
    const infoPrefix = new TextEncoder().encode(`HTE-v1/AES-256-GCM${T}`);
    const keyIdBytes = new TextEncoder().encode(KeyID);
    const infoInput = new Uint8Array(infoPrefix.length + ePK_bytes.length + keyIdBytes.length);
    infoInput.set(infoPrefix, 0);
    infoInput.set(ePK_bytes, infoPrefix.length);
    infoInput.set(keyIdBytes, infoPrefix.length + ePK_bytes.length);

    // 6. Derive transaction key KT (32 bytes)
    const KT = hkdf(sha256, Z, salt, infoInput, 32);

    // 7. Fresh 96-bit (12-byte) GCM IV from a CSPRNG (paper eq. 7).
    const iv = Crypto.getRandomBytes(12);

    const AAD_obj = { KeyID, N, S, T, TxID, ePK: ePK_hex, v };
    // Canonical JSON: sorted keys without extra spaces
    const AAD_str = JSON.stringify(AAD_obj);
    const AAD_bytes = new TextEncoder().encode(AAD_str);

    // 8. Authenticated Encryption with AES-256-GCM
    const aesCipher = gcm(KT, iv, AAD_bytes);
    const encrypted = aesCipher.encrypt(M_bytes);
    const ciphertext = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);

    // 10. Canonical ECDSA Signature over (v || KeyID || ePK || IV || C || Tag || AAD)
    const vKeyIdBytes = new TextEncoder().encode(`${v}${KeyID}`);
    const canonicalLength =
      vKeyIdBytes.length +
      ePK_bytes.length +
      iv.length +
      ciphertext.length +
      tag.length +
      AAD_bytes.length;

    const canonicalData = new Uint8Array(canonicalLength);
    let offset = 0;
    canonicalData.set(vKeyIdBytes, offset); offset += vKeyIdBytes.length;
    canonicalData.set(ePK_bytes, offset); offset += ePK_bytes.length;
    canonicalData.set(iv, offset); offset += iv.length;
    canonicalData.set(ciphertext, offset); offset += ciphertext.length;
    canonicalData.set(tag, offset); offset += tag.length;
    canonicalData.set(AAD_bytes, offset);

    // Hardware (Keystore) signature when available; otherwise software noble P-256.
    // The duress flag selects the signing key — the envelope bytes are identical.
    const sigHex = await signWithDeviceKey(canonicalData, duress);

    return {
      v,
      KeyID,
      AAD: AAD_obj,
      ePK: ePK_hex,
      IV: bytesToHex(iv),
      C: bytesToHex(ciphertext),
      Tag: bytesToHex(tag),
      Sig: sigHex,
    };
  } catch (error) {
    console.warn('[CRYPTO] Failed to create HTE envelope:', error);
    return null;
  }
}

// =========================================================================
// 3. Legacy RSA & QR Verification (Preserved for compatibility)
// =========================================================================

export async function generateRSAKeyPair(): Promise<{ publicKeyPem: string; success: boolean }> {
  try {
    const forge = require('node-forge');
    return new Promise((resolve) => {
      forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err: any, keypair: any) => {
        if (err) {
          resolve({ publicKeyPem: '', success: false });
          return;
        }
        try {
          const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
          const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
          SecureStore.setItemAsync(RSA_PRIVATE_KEY_ALIAS, privateKeyPem).catch(() => {});
          SecureStore.setItemAsync(RSA_PUBLIC_KEY_ALIAS, publicKeyPem).catch(() => {});
          resolve({ publicKeyPem, success: true });
        } catch {
          resolve({ publicKeyPem: '', success: false });
        }
      });
    });
  } catch {
    return { publicKeyPem: '', success: false };
  }
}

export async function getStoredPublicKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(RSA_PUBLIC_KEY_ALIAS);
  } catch {
    return null;
  }
}

export async function hasRSAKeys(): Promise<boolean> {
  try {
    const key = await SecureStore.getItemAsync(RSA_PUBLIC_KEY_ALIAS);
    return !!key;
  } catch {
    return false;
  }
}

export async function signQRPayload(payloadStr: string): Promise<string> {
  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `dpt_qr_sig_${payloadStr}`
    );
    return digest;
  } catch {
    return 'sig_fallback_' + Date.now();
  }
}

export async function verifyQRPayload(
  payloadStr: string,
  signatureHex: string,
  publicKeyPem?: string
): Promise<boolean> {
  if (!signatureHex || !payloadStr) return false;
  try {
    const fallbackDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `dpt_qr_sig_${payloadStr}`
    );
    if (fallbackDigest.toLowerCase() === signatureHex.toLowerCase()) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * Offline handoff uses the paper's signed HTE envelope P itself — no ad-hoc
 * HMAC receipt. The sender renders `serializeEnvelopeP(envelope)` as a QR code;
 * the receiver parses it and submits the SAME immutable P to `POST /transfer/claim`
 * so settlement stays receiver-authoritative.
 */
export function serializeEnvelopeP(envelope: HTEEnvelopePackage): string {
  return JSON.stringify(envelope);
}

export function parseEnvelopeP(raw: string): HTEEnvelopePackage | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.ePK && obj.AAD && obj.Sig) {
      return obj as HTEEnvelopePackage;
    }
    return null;
  } catch {
    return null;
  }
}
