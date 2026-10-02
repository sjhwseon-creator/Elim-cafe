package de.elimcafe.printerbridge.printer

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import java.util.UUID
import java.util.concurrent.Executors

@SuppressLint("MissingPermission")
class ClassicSppTransport(
    private val context: Context,
    override val device: BluetoothDevice
) : PrinterTransport {
    private val ioExecutor = Executors.newSingleThreadExecutor()
    @Volatile private var socket: BluetoothSocket? = null

    override val isConnected: Boolean
        get() = socket?.isConnected == true

    override fun connect(callback: (Result<Unit>) -> Unit) {
        ioExecutor.execute {
            try {
                val adapter = context.getSystemService(android.bluetooth.BluetoothManager::class.java).adapter
                adapter?.cancelDiscovery()
                socket = connectSocket(secure = true)
                callback(Result.success(Unit))
            } catch (secureError: Exception) {
                Log.w(TAG, "Secure SPP connection failed; trying insecure RFCOMM", secureError)
                closeSocket()
                try {
                    socket = connectSocket(secure = false)
                    callback(Result.success(Unit))
                } catch (insecureError: Exception) {
                    closeSocket()
                    callback(Result.failure(IllegalStateException(
                        "Bluetooth SPP failed: ${insecureError.message ?: secureError.message}",
                        insecureError
                    )))
                }
            }
        }
    }

    private fun connectSocket(secure: Boolean): BluetoothSocket {
        val candidate = if (secure) {
            device.createRfcommSocketToServiceRecord(SPP_UUID)
        } else {
            device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
        }
        return try {
            candidate.connect()
            candidate
        } catch (error: Exception) {
            try {
                candidate.close()
            } catch (_: Exception) {
            }
            throw error
        }
    }

    override fun print(data: ByteArray, callback: (Result<Unit>) -> Unit) {
        ioExecutor.execute {
            try {
                val active = socket?.takeIf { it.isConnected }
                    ?: throw IllegalStateException("Bluetooth SPP printer is not connected.")
                active.outputStream.write(data)
                active.outputStream.flush()
                callback(Result.success(Unit))
            } catch (error: Exception) {
                callback(Result.failure(error))
            }
        }
    }

    override fun disconnect() {
        closeSocket()
        ioExecutor.shutdownNow()
    }

    private fun closeSocket() {
        try {
            socket?.close()
        } catch (error: Exception) {
            Log.w(TAG, "Error closing RFCOMM socket", error)
        }
        socket = null
    }

    companion object {
        private const val TAG = "ElimPrinterSPP"
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}
