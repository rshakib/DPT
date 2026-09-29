package com.riajulshakib.dptapp

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * DptKeystoreModule — non-exportable device signing key (paper §2).
 *
 * Generates and uses a NIST P-256 ECDSA key inside the Android Keystore / StrongBox.
 * The private key never leaves secure hardware; signing happens inside the keystore.
 * Biometric / device-credential gated (auth valid for a short window so the app's
 * existing biometric prompt satisfies it).
 *
 * The JS side falls back to a software key if this module is unavailable or a
 * sign call fails, so the app always keeps working.
 */
class DptKeystoreModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DptKeystoreModule"

    private fun keyStore(): KeyStore {
        val ks = KeyStore.getInstance("AndroidKeyStore")
        ks.load(null)
        return ks
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            keyStore()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun hasKey(alias: String, promise: Promise) {
        try {
            promise.resolve(keyStore().containsAlias(alias))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun deleteKey(alias: String, promise: Promise) {
        try {
            val ks = keyStore()
            if (ks.containsAlias(alias)) ks.deleteEntry(alias)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("delete_failed", e)
        }
    }

    /**
     * Generate (or return) a hardware-backed P-256 ECDSA key; resolves with the
     * 65-byte uncompressed public key hex (04 || X || Y).
     */
    private fun buildSpec(alias: String, requireBiometric: Boolean, strongBox: Boolean): KeyGenParameterSpec {
        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)

        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // Request a dedicated secure element; falls back to TEE if unavailable.
            builder.setIsStrongBoxBacked(true)
        }
        if (requireBiometric) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setUserAuthenticationRequired(true)
                builder.setUserAuthenticationParameters(
                    300,
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                )
            } else {
                @Suppress("DEPRECATION")
                builder.setUserAuthenticationRequired(true)
                @Suppress("DEPRECATION")
                builder.setUserAuthenticationValidityDurationSeconds(300)
            }
        } else {
            builder.setUserAuthenticationRequired(false)
        }
        return builder.build()
    }

    @ReactMethod
    fun generateKey(alias: String, requireBiometric: Boolean, promise: Promise) {
        try {
            val ks = keyStore()
            if (ks.containsAlias(alias)) {
                promise.resolve(publicKeyHex(alias))
                return
            }

            val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            try {
                // Prefer StrongBox (paper Table 1), fall back to TEE-backed Keystore.
                kpg.initialize(buildSpec(alias, requireBiometric, true))
                kpg.generateKeyPair()
            } catch (strongBoxErr: Exception) {
                kpg.initialize(buildSpec(alias, requireBiometric, false))
                kpg.generateKeyPair()
            }
            promise.resolve(publicKeyHex(alias))
        } catch (e: Exception) {
            promise.reject("keygen_failed", e)
        }
    }

    /** True when the device key for [alias] lives inside secure hardware (TEE/StrongBox). */
    @ReactMethod
    fun isHardwareBacked(alias: String, promise: Promise) {
        try {
            val entry = keyStore().getEntry(alias, null) as? KeyStore.PrivateKeyEntry
            if (entry == null) {
                promise.resolve(false)
                return
            }
            val kf = java.security.KeyFactory.getInstance(entry.privateKey.algorithm, "AndroidKeyStore")
            val keyInfo = kf.getKeySpec(
                entry.privateKey,
                android.security.keystore.KeyInfo::class.java
            ) as android.security.keystore.KeyInfo
            promise.resolve(keyInfo.isInsideSecureHardware)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Sign the given base64 message with the hardware key; resolves with a
     * 64-byte raw r||s signature hex (matching the backend verifier).
     */
    @ReactMethod
    fun sign(alias: String, messageBase64: String, promise: Promise) {
        try {
            val ks = keyStore()
            val entry = ks.getEntry(alias, null) as? KeyStore.PrivateKeyEntry
            if (entry == null) {
                promise.reject("no_key", "No keystore key for alias $alias")
                return
            }
            val message = Base64.decode(messageBase64, Base64.NO_WRAP)
            val sig = Signature.getInstance("SHA256withECDSA")
            sig.initSign(entry.privateKey)
            sig.update(message)
            val der = sig.sign()
            promise.resolve(derToRawHex(der))
        } catch (e: Exception) {
            promise.reject("sign_failed", e)
        }
    }

    private fun publicKeyHex(alias: String): String {
        val cert = keyStore().getCertificate(alias)
            ?: throw IllegalStateException("No certificate for alias $alias")
        val pub = cert.publicKey as ECPublicKey
        val xb = to32(pub.w.affineX.toByteArray())
        val yb = to32(pub.w.affineY.toByteArray())
        val out = ByteArray(65)
        out[0] = 0x04
        System.arraycopy(xb, 0, out, 1, 32)
        System.arraycopy(yb, 0, out, 33, 32)
        return hex(out)
    }

    /** Convert a DER-encoded ECDSA signature to raw 64-byte r||s. */
    private fun derToRawHex(der: ByteArray): String {
        var i = 0
        if (der.size < 8 || der[i].toInt() != 0x30) return hex(der)
        i++
        if ((der[i].toInt() and 0x80) != 0) {
            val n = der[i].toInt() and 0x7f
            i += 1 + n
        } else {
            i++
        }
        if (der[i].toInt() != 0x02) return hex(der)
        i++
        val rLen = der[i].toInt(); i++
        val r = der.copyOfRange(i, i + rLen); i += rLen
        if (der[i].toInt() != 0x02) return hex(der)
        i++
        val sLen = der[i].toInt(); i++
        val s = der.copyOfRange(i, i + sLen)
        return hex(to32(stripLeadingZeros(r)) + to32(stripLeadingZeros(s)))
    }

    private fun stripLeadingZeros(b: ByteArray): ByteArray {
        var idx = 0
        while (idx < b.size - 1 && b[idx].toInt() == 0) idx++
        return b.copyOfRange(idx, b.size)
    }

    private fun to32(b: ByteArray): ByteArray {
        if (b.size == 32) return b
        if (b.size > 32) return b.copyOfRange(b.size - 32, b.size)
        val out = ByteArray(32)
        System.arraycopy(b, 0, out, 32 - b.size, b.size)
        return out
    }

    private fun hex(bytes: ByteArray): String {
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xff
            sb.append("0123456789abcdef"[v ushr 4])
            sb.append("0123456789abcdef"[v and 0x0f])
        }
        return sb.toString()
    }
}
