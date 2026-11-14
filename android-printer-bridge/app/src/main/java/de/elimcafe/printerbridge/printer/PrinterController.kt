package de.elimcafe.printerbridge.printer

import android.bluetooth.BluetoothDevice
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log

class PrinterController(
    private val context: Context,
    private val statusListener: (PrinterStatus) -> Unit
) {
    data class PrinterStatus(
        val state: String,
        val deviceName: String = "",
        val message: String = ""
    )

    private var transport: PrinterTransport? = null
    private var selectedDevice: BluetoothDevice? = null
    private var manualDisconnect = false
    private var reconnectScheduled = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var status = PrinterStatus("disconnected", message = "Select a Bluetooth receipt printer.")

    fun currentStatus(): PrinterStatus = status

    fun isConnected(): Boolean = transport?.isConnected == true

    fun connect(device: BluetoothDevice, callback: (Result<Unit>) -> Unit) {
        manualDisconnect = false
        selectedDevice = device
        reconnectScheduled = false
        mainHandler.removeCallbacksAndMessages(RECONNECT_TOKEN)
        connectInternal(device, callback)
    }

    private fun connectInternal(device: BluetoothDevice, callback: (Result<Unit>) -> Unit) {
        closeTransport()
        val name = safeName(device)
        update(PrinterStatus("connecting", name, "Inspecting $name Bluetooth services..."))

        val canTryBle = device.type == BluetoothDevice.DEVICE_TYPE_LE ||
            device.type == BluetoothDevice.DEVICE_TYPE_DUAL ||
            device.type == BluetoothDevice.DEVICE_TYPE_UNKNOWN

        if (canTryBle) {
            lateinit var ble: BleEscPosTransport
            ble = BleEscPosTransport(context, device) { error ->
                if (transport === ble) {
                    closeTransport()
                    scheduleReconnect(device, name, error)
                }
            }
            ble.connect { result ->
                if (result.isSuccess) {
                    transport = ble
                    reconnectScheduled = false
                    update(PrinterStatus("connected", name, "Connected over BLE GATT."))
                    callback(Result.success(Unit))
                } else {
                    Log.w(TAG, "BLE connection unsuitable; attempting SPP", result.exceptionOrNull())
                    ble.disconnect()
                    tryClassic(device, name, result.exceptionOrNull(), callback)
                }
            }
            return
        }

        tryClassic(device, name, null, callback)
    }

    private fun tryClassic(
        device: BluetoothDevice,
        name: String,
        bleError: Throwable?,
        callback: (Result<Unit>) -> Unit
    ) {
        update(PrinterStatus("connecting", name, "BLE unavailable; trying Bluetooth Classic SPP..."))
        val classic = ClassicSppTransport(context, device)
        classic.connect { result ->
            if (result.isSuccess) {
                transport = classic
                reconnectScheduled = false
                update(PrinterStatus("connected", name, "Connected over Bluetooth Classic SPP."))
                callback(Result.success(Unit))
            } else {
                val detail = listOfNotNull(bleError?.message, result.exceptionOrNull()?.message)
                    .joinToString("; ")
                val error = IllegalStateException(detail.ifBlank { "Could not connect to the printer." })
                update(PrinterStatus("error", name, error.message ?: "Printer connection failed."))
                callback(Result.failure(error))
            }
        }
    }

    fun print(data: ByteArray, callback: (Result<Unit>) -> Unit) {
        printWithReconnect(data, retryAllowed = true, callback)
    }

    private fun printWithReconnect(
        data: ByteArray,
        retryAllowed: Boolean,
        callback: (Result<Unit>) -> Unit
    ) {
        val active = transport
        if (active?.isConnected != true) {
            val device = selectedDevice
            if (retryAllowed && !manualDisconnect && device != null) {
                reconnectAndPrint(device, data, callback)
                return
            }
            callback(Result.failure(IllegalStateException("Connect a printer first.")))
            return
        }

        val name = safeName(active.device)
        update(PrinterStatus("printing", name, "Sending ${data.size} ESC/POS bytes..."))
        active.print(data) { result ->
            if (result.isSuccess) {
                update(PrinterStatus("connected", name, "Test receipt sent to printer."))
                callback(result)
            } else if (retryAllowed && !manualDisconnect) {
                val device = selectedDevice
                if (device != null) {
                    Log.w(TAG, "Print failed; reconnecting once and retrying", result.exceptionOrNull())
                    closeTransport()
                    reconnectAndPrint(device, data, callback)
                } else {
                    update(PrinterStatus("error", name, result.exceptionOrNull()?.message ?: "Print failed."))
                    callback(result)
                }
            } else {
                update(PrinterStatus("error", name, result.exceptionOrNull()?.message ?: "Print failed."))
                callback(result)
            }
        }
    }

    private fun reconnectAndPrint(
        device: BluetoothDevice,
        data: ByteArray,
        callback: (Result<Unit>) -> Unit
    ) {
        val name = safeName(device)
        update(PrinterStatus("connecting", name, "Printer connection was lost. Reconnecting..."))
        connectInternal(device) { reconnectResult ->
            if (reconnectResult.isSuccess) {
                printWithReconnect(data, retryAllowed = false, callback)
            } else {
                callback(Result.failure(reconnectResult.exceptionOrNull()
                    ?: IllegalStateException("Could not reconnect to the printer.")))
            }
        }
    }

    private fun scheduleReconnect(device: BluetoothDevice, name: String, cause: Throwable) {
        if (manualDisconnect || reconnectScheduled) return
        reconnectScheduled = true
        update(PrinterStatus("connecting", name, "Printer disconnected. Reconnecting..."))
        mainHandler.postAtTime({
            reconnectScheduled = false
            if (manualDisconnect) return@postAtTime
            connectInternal(device) { result ->
                if (result.isFailure) {
                    update(PrinterStatus(
                        "error",
                        name,
                        result.exceptionOrNull()?.message ?: cause.message ?: "Automatic reconnection failed."
                    ))
                }
            }
        }, RECONNECT_TOKEN, android.os.SystemClock.uptimeMillis() + RECONNECT_DELAY_MS)
    }

    fun disconnect() {
        manualDisconnect = true
        selectedDevice = null
        reconnectScheduled = false
        mainHandler.removeCallbacksAndMessages(RECONNECT_TOKEN)
        closeTransport()
        update(PrinterStatus("disconnected", message = "Printer disconnected."))
    }

    private fun closeTransport() {
        val active = transport
        transport = null
        active?.disconnect()
    }

    @Suppress("MissingPermission")
    private fun safeName(device: BluetoothDevice): String = try {
        device.name?.takeIf { it.isNotBlank() } ?: "Bluetooth printer"
    } catch (_: SecurityException) {
        "Bluetooth printer"
    }

    private fun update(next: PrinterStatus) {
        status = next
        statusListener(next)
    }

    companion object {
        private const val TAG = "ElimPrinter"
        private const val RECONNECT_DELAY_MS = 1_500L
        private val RECONNECT_TOKEN = Any()
    }
}
