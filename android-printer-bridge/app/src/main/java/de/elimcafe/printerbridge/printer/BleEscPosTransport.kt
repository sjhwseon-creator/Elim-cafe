package de.elimcafe.printerbridge.printer

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.ArrayDeque
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@SuppressLint("MissingPermission")
class BleEscPosTransport(
    private val context: Context,
    override val device: BluetoothDevice,
    private val connectionLost: (Throwable) -> Unit = {}
) : PrinterTransport {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val writer = Executors.newSingleThreadExecutor()
    private var gatt: BluetoothGatt? = null
    private var writable: BluetoothGattCharacteristic? = null
    private var connectCallback: ((Result<Unit>) -> Unit)? = null
    private var printCallback: ((Result<Unit>) -> Unit)? = null
    private val writeQueue = ArrayDeque<ByteArray>()
    private var noResponseWrite = false
    private var mtuPayload = DEFAULT_PAYLOAD_SIZE
    private var connected = false
    private val closed = AtomicBoolean(false)

    override val isConnected: Boolean
        get() = connected && writable != null && !closed.get()

    private val timeout = Runnable {
        failConnection(IllegalStateException("BLE connection or service discovery timed out."))
    }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            Log.i(TAG, "GATT connection status=$status state=$newState")
            if (status != BluetoothGatt.GATT_SUCCESS) {
                failConnection(IllegalStateException("BLE GATT connection failed with status $status."))
                return
            }

            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    connected = true
                    if (!gatt.requestMtu(247)) gatt.discoverServices()
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    connected = false
                    writable = null
                    if (!closed.get()) {
                        val error = IllegalStateException("BLE printer disconnected.")
                        if (connectCallback != null) failConnection(error) else connectionLost(error)
                    }
                }
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                mtuPayload = (mtu - 3).coerceAtLeast(DEFAULT_PAYLOAD_SIZE)
                Log.i(TAG, "GATT MTU=$mtu payload=$mtuPayload")
            }
            gatt.discoverServices()
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                failConnection(IllegalStateException("BLE service discovery failed with status $status."))
                return
            }

            writable = findWritableCharacteristic(gatt.services)
            val selected = writable
            if (selected == null) {
                failConnection(IllegalStateException("No BLE WRITE or WRITE_NO_RESPONSE characteristic was found."))
                return
            }

            noResponseWrite = selected.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0
            selected.writeType = if (noResponseWrite) {
                BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            } else {
                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            }
            mainHandler.removeCallbacks(timeout)
            connectCallback?.also { connectCallback = null }?.invoke(Result.success(Unit))
        }

        @Deprecated("Used for Android versions below API 33")
        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            if (noResponseWrite) return
            if (status != BluetoothGatt.GATT_SUCCESS) {
                finishPrint(Result.failure(IllegalStateException("BLE write failed with status $status.")))
                return
            }
            writeNextWithResponse()
        }
    }

    override fun connect(callback: (Result<Unit>) -> Unit) {
        connectCallback = callback
        closed.set(false)
        mainHandler.postDelayed(timeout, CONNECTION_TIMEOUT_MS)
        try {
            gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                device.connectGatt(context, false, this.callback, BluetoothDevice.TRANSPORT_LE)
            } else {
                device.connectGatt(context, false, this.callback)
            }
        } catch (error: Exception) {
            failConnection(error)
        }
    }

    override fun print(data: ByteArray, callback: (Result<Unit>) -> Unit) {
        val characteristic = writable
        val activeGatt = gatt
        if (!isConnected || characteristic == null || activeGatt == null) {
            callback(Result.failure(IllegalStateException("BLE printer is not connected.")))
            return
        }
        if (printCallback != null) {
            callback(Result.failure(IllegalStateException("A print is already in progress.")))
            return
        }

        printCallback = callback
        writeQueue.clear()
        data.asList().chunked(mtuPayload).forEach { chunk ->
            writeQueue.add(chunk.toByteArray())
        }

        if (noResponseWrite) {
            writer.execute {
                try {
                    while (writeQueue.isNotEmpty()) {
                        val chunk = writeQueue.removeFirst()
                        if (!write(activeGatt, characteristic, chunk)) {
                            throw IllegalStateException("BLE rejected an ESC/POS data chunk.")
                        }
                        Thread.sleep(NO_RESPONSE_DELAY_MS)
                    }
                    finishPrint(Result.success(Unit))
                } catch (error: Exception) {
                    finishPrint(Result.failure(error))
                }
            }
        } else {
            writeNextWithResponse()
        }
    }

    private fun writeNextWithResponse() {
        val activeGatt = gatt
        val characteristic = writable
        if (activeGatt == null || characteristic == null) {
            finishPrint(Result.failure(IllegalStateException("BLE connection was lost.")))
            return
        }
        if (writeQueue.isEmpty()) {
            finishPrint(Result.success(Unit))
            return
        }
        if (!write(activeGatt, characteristic, writeQueue.removeFirst())) {
            finishPrint(Result.failure(IllegalStateException("BLE rejected an ESC/POS data chunk.")))
        }
    }

    private fun write(
        activeGatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        data: ByteArray
    ): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        activeGatt.writeCharacteristic(characteristic, data, characteristic.writeType) == BluetoothGatt.GATT_SUCCESS
    } else {
        legacyWrite(activeGatt, characteristic, data)
    }

    @Suppress("DEPRECATION")
    private fun legacyWrite(
        activeGatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        data: ByteArray
    ): Boolean {
        characteristic.value = data
        return activeGatt.writeCharacteristic(characteristic)
    }

    private fun findWritableCharacteristic(services: List<BluetoothGattService>): BluetoothGattCharacteristic? {
        var withResponse: BluetoothGattCharacteristic? = null
        services.forEach { service ->
            Log.i(TAG, "GATT service ${service.uuid}")
            service.characteristics.forEach { characteristic ->
                val properties = characteristic.properties
                Log.i(TAG, "GATT characteristic ${characteristic.uuid} properties=0x${properties.toString(16)} ${propertyNames(properties)}")
                if (properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) {
                    return characteristic
                }
                if (properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0 && withResponse == null) {
                    withResponse = characteristic
                }
            }
        }
        return withResponse
    }

    private fun propertyNames(properties: Int): String = buildList {
        if (properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) add("READ")
        if (properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) add("WRITE")
        if (properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) add("WRITE_NO_RESPONSE")
        if (properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) add("NOTIFY")
        if (properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) add("INDICATE")
    }.joinToString("|")

    private fun failConnection(error: Throwable) {
        mainHandler.removeCallbacks(timeout)
        connected = false
        connectCallback?.also { connectCallback = null }?.invoke(Result.failure(error))
        if (printCallback != null) finishPrint(Result.failure(error))
    }

    private fun finishPrint(result: Result<Unit>) {
        val callback = printCallback ?: return
        printCallback = null
        writeQueue.clear()
        callback(result)
    }

    override fun disconnect() {
        mainHandler.removeCallbacks(timeout)
        closed.set(true)
        connected = false
        writable = null
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (error: Exception) {
            Log.w(TAG, "Error closing GATT", error)
        }
        gatt = null
        writer.shutdownNow()
    }

    companion object {
        private const val TAG = "ElimPrinterBLE"
        private const val DEFAULT_PAYLOAD_SIZE = 20
        private const val CONNECTION_TIMEOUT_MS = 15_000L
        private const val NO_RESPONSE_DELAY_MS = 35L
    }
}
