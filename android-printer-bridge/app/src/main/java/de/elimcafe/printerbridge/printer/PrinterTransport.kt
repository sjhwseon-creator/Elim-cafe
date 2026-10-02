package de.elimcafe.printerbridge.printer

import android.bluetooth.BluetoothDevice

interface PrinterTransport {
    val device: BluetoothDevice
    val isConnected: Boolean

    fun connect(callback: (Result<Unit>) -> Unit)
    fun print(data: ByteArray, callback: (Result<Unit>) -> Unit)
    fun disconnect()
}
