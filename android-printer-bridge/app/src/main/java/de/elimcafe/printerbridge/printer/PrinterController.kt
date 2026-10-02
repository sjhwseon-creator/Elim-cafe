package de.elimcafe.printerbridge.printer

import android.bluetooth.BluetoothDevice
import android.content.Context
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
    private var status = PrinterStatus("disconnected", message = "Select a Bluetooth receipt printer.")

    fun currentStatus(): PrinterStatus = status

    fun isConnected(): Boolean = transport?.isConnected == true

    fun connect(device: BluetoothDevice, callback: (Result<Unit>) -> Unit) {
        disconnect()
        val name = safeName(device)
        update(PrinterStatus("connecting", name, "Inspecting $name Bluetooth services..."))

        val canTryBle = device.type == BluetoothDevice.DEVICE_TYPE_LE ||
            device.type == BluetoothDevice.DEVICE_TYPE_DUAL ||
            device.type == BluetoothDevice.DEVICE_TYPE_UNKNOWN

        if (canTryBle) {
            lateinit var ble: BleEscPosTransport
            ble = BleEscPosTransport(context, device) { error ->
                if (transport === ble) {
                    transport = null
                    update(PrinterStatus("error", name, error.message ?: "BLE printer disconnected."))
                }
            }
            ble.connect { result ->
                if (result.isSuccess) {
                    transport = ble
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
        val active = transport
        if (active?.isConnected != true) {
            callback(Result.failure(IllegalStateException("Connect a printer first.")))
            return
        }

        val name = safeName(active.device)
        update(PrinterStatus("printing", name, "Sending ${data.size} ESC/POS bytes..."))
        active.print(data) { result ->
            if (result.isSuccess) {
                update(PrinterStatus("connected", name, "Test receipt sent to printer."))
            } else {
                update(PrinterStatus("error", name, result.exceptionOrNull()?.message ?: "Print failed."))
            }
            callback(result)
        }
    }

    fun disconnect() {
        transport?.disconnect()
        transport = null
        update(PrinterStatus("disconnected", message = "Printer disconnected."))
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
    }
}
