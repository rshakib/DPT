package com.riajulshakib.dptapp

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import java.nio.charset.StandardCharsets

class DptHceService : HostApduService() {

    companion object {
        private const val TAG = "DptHceService"

        // Custom AID: F0010203040506 (7 bytes)
        val AID_BYTES = byteArrayOf(
            0xF0.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(),
            0x04.toByte(), 0x05.toByte(), 0x06.toByte()
        )

        // Standard Status Words
        val SW_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
        val SW_ERROR = byteArrayOf(0x6F.toByte(), 0x00.toByte())
        val SW_WRONG_LENGTH = byteArrayOf(0x67.toByte(), 0x00.toByte())

        @Volatile
        var isReceiverActive: Boolean = false

        @Volatile
        var receiverUsername: String = ""

        // Thread-safe buffer to guarantee ZERO packet loss even if event listener is delayed
        @Volatile
        private var lastReceivedPayment: String? = null

        // Callbacks for JS event emission
        var paymentCallback: ((String) -> Unit)? = null
        var deactivatedCallback: ((Int) -> Unit)? = null

        fun popLastPayment(): String? {
            val payment = lastReceivedPayment
            lastReceivedPayment = null
            return payment
        }

        fun peekLastPayment(): String? = lastReceivedPayment

        fun clearLastPayment() {
            lastReceivedPayment = null
        }

        // P1 FIX: Reset all static state (call on app launch to prevent stale state)
        fun resetState() {
            isReceiverActive = false
            receiverUsername = ""
            lastReceivedPayment = null
        }
    }

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || commandApdu.size < 4) {
            return SW_ERROR
        }

        val cla = commandApdu[0].toInt() and 0xFF
        val ins = commandApdu[1].toInt() and 0xFF

        Log.d(TAG, "processCommandApdu: CLA=0x${Integer.toHexString(cla)}, INS=0x${Integer.toHexString(ins)}, size=${commandApdu.size}")

        // 1. SELECT AID COMMAND: 00 A4 04 00 [Lc] [AID] (with or without Le)
        if (cla == 0x00 && ins == 0xA4) {
            if (!isReceiverActive) {
                Log.w(TAG, "SELECT AID received, but receiver is not active.")
                return SW_ERROR
            }

            Log.i(TAG, "SELECT AID matched! Receiver ready: @$receiverUsername")
            val respJson = "{\"status\":\"READY\",\"receiver\":\"$receiverUsername\"}"
            val respBytes = respJson.toByteArray(StandardCharsets.UTF_8)
            return respBytes + SW_SUCCESS
        }

        // 2. PROCESS PAYMENT COMMAND: 80 B0 00 00 [Lc] [Data...]
        if (cla == 0x80 && ins == 0xB0) {
            if (commandApdu.size < 5) return SW_WRONG_LENGTH

            // Safely parse data bytes
            val lc = commandApdu[4].toInt() and 0xFF
            val dataBytes = if (lc > 0 && commandApdu.size >= 5 + lc) {
                commandApdu.copyOfRange(5, 5 + lc)
            } else {
                commandApdu.copyOfRange(5, commandApdu.size)
            }

            val paymentJson = String(dataBytes, StandardCharsets.UTF_8)
            Log.i(TAG, ">>> PAYMENT PACKET RECEIVED (${dataBytes.size} bytes): $paymentJson <<<")

            // Store in memory buffer immediately so polling catches it even if event listener missed it
            lastReceivedPayment = paymentJson

            // Emit event via callback and static method
            try {
                paymentCallback?.invoke(paymentJson)
                DptHceModule.emitPaymentReceived(paymentJson)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit payment event", e)
            }

            val ackJson = "{\"status\":\"SUCCESS\",\"receiver\":\"$receiverUsername\"}"
            val ackBytes = ackJson.toByteArray(StandardCharsets.UTF_8)
            return ackBytes + SW_SUCCESS
        }

        // Unknown command
        return SW_ERROR
    }

    // P1 FIX: Notify JS layer when NFC field is lost
    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "onDeactivated: reason=$reason")
        try {
            deactivatedCallback?.invoke(reason)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to invoke deactivated callback", e)
        }
    }
}
