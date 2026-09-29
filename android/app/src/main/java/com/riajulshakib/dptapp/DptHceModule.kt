package com.riajulshakib.dptapp

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.cardemulation.CardEmulation
import android.nfc.tech.IsoDep
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.IOException
import java.nio.charset.StandardCharsets

class DptHceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        const val MODULE_NAME = "DptHceModule"
        const val EVENT_PAYMENT_RECEIVED = "onNfcHcePaymentReceived"
        private const val TAG = "DptHceModule"
        private const val MAX_PAYLOAD_BYTES = 200

        private var instance: DptHceModule? = null

        // Custom AID: F0010203040506 (7 bytes)
        val AID_BYTES = byteArrayOf(
            0xF0.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(),
            0x04.toByte(), 0x05.toByte(), 0x06.toByte()
        )

        // APDU: SELECT AID with Le (00 A4 04 00 07 F0 01 02 03 04 05 06 00)
        val SELECT_AID_APDU_WITH_LE = byteArrayOf(
            0x00.toByte(), // CLA
            0xA4.toByte(), // INS (SELECT)
            0x04.toByte(), // P1 (Select by AID)
            0x00.toByte(), // P2
            0x07.toByte(), // Lc (AID length)
            0xF0.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(),
            0x04.toByte(), 0x05.toByte(), 0x06.toByte(), // AID
            0x00.toByte()  // Le
        )

        // APDU: SELECT AID without Le (00 A4 04 00 07 F0 01 02 03 04 05 06)
        val SELECT_AID_APDU_NO_LE = byteArrayOf(
            0x00.toByte(), // CLA
            0xA4.toByte(), // INS (SELECT)
            0x04.toByte(), // P1 (Select by AID)
            0x00.toByte(), // P2
            0x07.toByte(), // Lc (AID length)
            0xF0.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(),
            0x04.toByte(), 0x05.toByte(), 0x06.toByte() // AID
        )

        fun emitPaymentReceived(payloadJson: String) {
            instance?.let { module ->
                module.triggerSuccessVibration()
                module.sendEvent(EVENT_PAYMENT_RECEIVED, payloadJson)
            }
        }
    }

    @Volatile
    private var isTransceiving = false
    private var pendingSendPromise: Promise? = null
    private var pendingSendPayload: String? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var sendTimeoutRunnable: Runnable? = null

    init {
        instance = this
        reactContext.addLifecycleEventListener(this)
        // P1 FIX: Reset HCE state on app launch to prevent stale state from previous session
        DptHceService.resetState()
    }

    override fun getName(): String {
        return MODULE_NAME
    }

    // =========================================================================
    // RECEIVER (HCE CARD EMULATION) CONTROLS
    // =========================================================================

    @ReactMethod
    fun setReceiverActive(username: String, active: Boolean, promise: Promise) {
        try {
            DptHceService.receiverUsername = username
            DptHceService.isReceiverActive = active
            if (active) {
                DptHceService.clearLastPayment()
            }

            val activity = reactContext.currentActivity
            val component = ComponentName(reactContext, DptHceService::class.java)

            // Foreground service preference routing without disabling component in OS
            activity?.let { act ->
                act.runOnUiThread {
                    try {
                        val nfcAdapter = NfcAdapter.getDefaultAdapter(act)
                        if (nfcAdapter != null) {
                            val cardEmulation = CardEmulation.getInstance(nfcAdapter)
                            // Dynamically register AID to guarantee it exists in Android's routing table
                            try {
                                cardEmulation.registerAidsForService(
                                    component,
                                    CardEmulation.CATEGORY_OTHER,
                                    arrayListOf("F0010203040506")
                                )
                            } catch (e: Exception) {
                                Log.w(TAG, "registerAidsForService notice: ${e.message}")
                            }

                            if (active) {
                                val ok = cardEmulation.setPreferredService(act, component)
                                Log.i(TAG, "CardEmulation.setPreferredService result: $ok for DptHceService")
                            } else {
                                cardEmulation.unsetPreferredService(act)
                                Log.i(TAG, "CardEmulation.unsetPreferredService DISABLED")
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed setting card emulation preference: ${e.message}")
                    }
                }
            }

            Log.i(TAG, "HCE Receiver active state set to: $active for user: @$username")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set HCE receiver active state", e)
            promise.reject("HCE_ERROR", e.message, e)
        }
    }

    // =========================================================================
    // SENDER (HIGH-SPEED NATIVE READER MODE) CONTROLS
    // =========================================================================

    @ReactMethod
    fun sendPaymentNative(payloadJson: String, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }

        val nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
        if (nfcAdapter == null || !nfcAdapter.isEnabled) {
            promise.reject("NFC_DISABLED", "NFC is not enabled on this device")
            return
        }

        // P0 FIX: Validate payload size before sending
        val payloadBytes = payloadJson.toByteArray(StandardCharsets.UTF_8)
        if (payloadBytes.size > MAX_PAYLOAD_BYTES) {
            promise.reject("PAYLOAD_TOO_LARGE", "NFC payload exceeds ${MAX_PAYLOAD_BYTES} bytes (${payloadBytes.size}). Use shorter usernames.")
            return
        }

        // Cancel previous pending operation if any
        cancelPendingSend("SUPERSEDED", "A new payment was initiated")

        pendingSendPromise = promise
        pendingSendPayload = payloadJson
        isTransceiving = false

        // 45-second overall timeout
        sendTimeoutRunnable = Runnable {
            Log.w(TAG, "Native ReaderMode timed out waiting for NFC tap")
            cancelPendingSend("TIMEOUT", "NFC transfer timed out. Make sure the receiver phone is ready.")
        }
        mainHandler.postDelayed(sendTimeoutRunnable!!, 45000)

        activity.runOnUiThread {
            try {
                val options = Bundle().apply {
                    putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250)
                }
                // Target both ISO 14443-4 Type A & Type B cards, bypass OS NDEF detection
                val flags = NfcAdapter.FLAG_READER_NFC_A or
                        NfcAdapter.FLAG_READER_NFC_B or
                        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
                        NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS

                nfcAdapter.enableReaderMode(activity, readerCallback, flags, options)
                Log.i(TAG, "Native ReaderMode enabled with NFC_A & NFC_B & SKIP_NDEF_CHECK")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to enable native ReaderMode", e)
                cancelPendingSend("ENABLE_FAILED", e.message ?: "Failed to enable reader mode")
            }
        }
    }

    @ReactMethod
    fun cancelSendPayment(promise: Promise) {
        try {
            cancelPendingSend("CANCELLED", "NFC transfer cancelled by user")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    private val readerCallback = NfcAdapter.ReaderCallback { tag ->
        if (isTransceiving) {
            Log.d(TAG, "ReaderCallback: already transceiving, ignoring duplicate event")
            return@ReaderCallback
        }

        val isoDep = IsoDep.get(tag)
        if (isoDep == null) {
            Log.w(TAG, "Detected NFC device does not support IsoDep")
            return@ReaderCallback
        }

        isTransceiving = true
        Log.i(TAG, "IsoDep device detected! Connecting...")

        try {
            isoDep.connect()
            isoDep.timeout = 6000 // 6 seconds connection timeout

            // 1. SELECT AID (Try with Le first, fallback to without Le)
            Log.d(TAG, "Transceiving SELECT AID APDU...")
            var selectResponse = try {
                isoDep.transceive(SELECT_AID_APDU_WITH_LE)
            } catch (e: Exception) {
                null
            }

            var isSelectOk = false
            if (selectResponse != null && selectResponse.size >= 2) {
                val sw1 = selectResponse[selectResponse.size - 2].toInt() and 0xFF
                val sw2 = selectResponse[selectResponse.size - 1].toInt() and 0xFF
                if (sw1 == 0x90 && sw2 == 0x00) {
                    isSelectOk = true
                }
            }

            if (!isSelectOk) {
                Log.d(TAG, "SELECT AID with Le failed, retrying without Le...")
                selectResponse = try {
                    isoDep.transceive(SELECT_AID_APDU_NO_LE)
                } catch (e: Exception) {
                    null
                }
                if (selectResponse != null && selectResponse.size >= 2) {
                    val sw1 = selectResponse[selectResponse.size - 2].toInt() and 0xFF
                    val sw2 = selectResponse[selectResponse.size - 1].toInt() and 0xFF
                    if (sw1 == 0x90 && sw2 == 0x00) {
                        isSelectOk = true
                    }
                }
            }

            // P0 FIX: Reject promise immediately when SELECT AID fails
            if (!isSelectOk || selectResponse == null || selectResponse.size < 2) {
                Log.w(TAG, "SELECT AID rejected by card target")
                cancelPendingSend("SELECT_FAILED", "Receiver phone not ready. Make sure receiver is on the Receive screen.")
                return@ReaderCallback
            }

            var detectedReceiver = ""
            if (selectResponse.size > 2) {
                try {
                    val respBody = String(
                        selectResponse.copyOfRange(0, selectResponse.size - 2),
                        StandardCharsets.UTF_8
                    )
                    val json = JSONObject(respBody)
                    detectedReceiver = json.optString("receiver", "")
                    Log.i(TAG, "Receiver identified as: @$detectedReceiver")
                } catch (e: Exception) {
                    Log.w(TAG, "Could not parse SELECT JSON: ${e.message}")
                }
            }

            // 2. PROCESS PAYMENT APDU: CLA=0x80, INS=0xB0, P1=0x00, P2=0x00, Lc, Data...
            val payloadStr = pendingSendPayload ?: ""
            val sendDataBytes = payloadStr.toByteArray(StandardCharsets.UTF_8)
            val paymentApdu = ByteArray(5 + sendDataBytes.size)
            paymentApdu[0] = 0x80.toByte() // CLA
            paymentApdu[1] = 0xB0.toByte() // INS
            paymentApdu[2] = 0x00.toByte() // P1
            paymentApdu[3] = 0x00.toByte() // P2
            paymentApdu[4] = (sendDataBytes.size and 0xFF).toByte() // Lc
            System.arraycopy(sendDataBytes, 0, paymentApdu, 5, sendDataBytes.size)

            Log.i(TAG, "Transceiving PROCESS_PAYMENT APDU (${sendDataBytes.size} bytes)...")
            val payResponse = isoDep.transceive(paymentApdu)
            if (payResponse == null || payResponse.size < 2) {
                Log.w(TAG, "PROCESS_PAYMENT response invalid")
                cancelPendingSend("PAYMENT_NO_RESPONSE", "Payment transmission failed: no confirmation from receiver.")
                return@ReaderCallback
            }

            val paySw1 = payResponse[payResponse.size - 2].toInt() and 0xFF
            val paySw2 = payResponse[payResponse.size - 1].toInt() and 0xFF

            if (paySw1 == 0x90 && paySw2 == 0x00) {
                Log.i(TAG, ">>> PAYMENT TRANSMISSION SUCCESSFUL (90 00) <<<")
                triggerSuccessVibration()

                val resultMap = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("receiver", detectedReceiver)
                }

                // Clean up timeout and reader mode
                sendTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                sendTimeoutRunnable = null

                val promise = pendingSendPromise
                pendingSendPromise = null
                pendingSendPayload = null

                disableReaderModeSafe()
                promise?.resolve(resultMap)
            } else {
                // P0 FIX: Reject promise when receiver rejects payment
                Log.w(TAG, "Payment rejected by receiver with SW: $paySw1 $paySw2")
                cancelPendingSend("PAYMENT_REJECTED", "Receiver rejected the payment payload.")
            }
        } catch (e: IOException) {
            Log.w(TAG, "NFC contact lost or APDU transceive failed: ${e.message}")
            cancelPendingSend("NFC_IO_ERROR", "NFC connection lost. Please try again.")
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error in readerCallback", e)
            cancelPendingSend("NFC_ERROR", "NFC error: ${e.message}")
        } finally {
            try {
                isoDep.close()
            } catch (_: Exception) {}
            isTransceiving = false
        }
    }

    private fun disableReaderModeSafe() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            try {
                val nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
                nfcAdapter?.disableReaderMode(activity)
                Log.i(TAG, "Native ReaderMode disabled safely")
            } catch (e: Exception) {
                Log.w(TAG, "Error disabling reader mode: ${e.message}")
            }
        }
    }

    private fun cancelPendingSend(code: String, message: String) {
        sendTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        sendTimeoutRunnable = null

        val promise = pendingSendPromise
        pendingSendPromise = null
        pendingSendPayload = null

        disableReaderModeSafe()
        promise?.reject(code, message)
    }

    // =========================================================================
    // HARDWARE CHECKS & UTILITIES
    // =========================================================================

    @ReactMethod
    fun isHceSupported(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val hasHce = pm.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)
            promise.resolve(hasHce)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isNfcEnabled(promise: Promise) {
        try {
            val activity = reactContext.currentActivity ?: reactContext
            val nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
            promise.resolve(nfcAdapter?.isEnabled == true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun popLatestReceivedPayment(promise: Promise) {
        try {
            val payment = DptHceService.popLastPayment()
            promise.resolve(payment)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun triggerSuccessVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(
                        VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(150)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to trigger vibration: ${e.message}")
        }
    }

    private fun sendEvent(eventName: String, data: String) {
        try {
            val params = Arguments.createMap().apply {
                putString("payload", data)
            }
            if (reactContext.hasActiveReactInstance()) {
                reactContext.runOnJSQueueThread {
                    try {
                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit(eventName, params)
                        Log.i(TAG, "Emitted event $eventName with payload to JS thread")
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to emit event $eventName on JS thread", e)
                    }
                }
            } else {
                Log.w(TAG, "Cannot emit event $eventName: React instance not active")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to prepare event $eventName", e)
        }
    }

    // =========================================================================
    // LIFECYCLE LISTENER (FOREGROUND / BACKGROUND MANAGEMENT)
    // =========================================================================

    override fun onHostResume() {
        val activity = reactContext.currentActivity ?: return
        if (DptHceService.isReceiverActive) {
            activity.runOnUiThread {
                try {
                    val nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
                    if (nfcAdapter != null) {
                        val cardEmulation = CardEmulation.getInstance(nfcAdapter)
                        val component = ComponentName(activity, DptHceService::class.java)
                        cardEmulation.setPreferredService(activity, component)
                        Log.i(TAG, "onHostResume: Re-established setPreferredService for DptHceService")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "onHostResume error: ${e.message}")
                }
            }
        }
    }

    override fun onHostPause() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            try {
                val nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
                if (nfcAdapter != null) {
                    val cardEmulation = CardEmulation.getInstance(nfcAdapter)
                    cardEmulation.unsetPreferredService(activity)
                    Log.i(TAG, "onHostPause: Unset setPreferredService")
                }
            } catch (e: Exception) {
                Log.w(TAG, "onHostPause error: ${e.message}")
            }
        }
    }

    override fun onHostDestroy() {
        cancelPendingSend("DESTROYED", "Activity destroyed")
    }
}
