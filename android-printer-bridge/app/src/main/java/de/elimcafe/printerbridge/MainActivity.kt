package de.elimcafe.printerbridge

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.companion.AssociationInfo
import android.companion.AssociationRequest
import android.companion.BluetoothDeviceFilter
import android.companion.BluetoothLeDeviceFilter
import android.companion.CompanionDeviceManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.IntentSender
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.Toast
import de.elimcafe.printerbridge.printer.PrinterController
import de.elimcafe.printerbridge.web.WebPrinterBridge
import org.json.JSONObject

class MainActivity : Activity(), WebPrinterBridge.Host {
    private lateinit var webView: WebView
    private lateinit var bridge: WebPrinterBridge
    private lateinit var printer: PrinterController
    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        getSystemService(BluetoothManager::class.java)?.adapter
    }

    private var pendingConnectRequestId: String? = null
    private var selectorDialog: AlertDialog? = null
    private var receiverRegistered = false
    private var bleScanRunning = false
    private val discoveredDevices = linkedMapOf<String, BluetoothDevice>()
    private var deviceListAdapter: ArrayAdapter<String>? = null
    private val scanHandler = Handler(Looper.getMainLooper())

    private val classicScanFallback = Runnable {
        startClassicDiscovery()
    }

    private val emptyScanNotice = Runnable {
        if (discoveredDevices.isEmpty()) {
            selectorDialog?.setMessage(
                "No devices found yet. Turn on Android Location, keep the printer powered on and nearby, then tap Scan again."
            )
        }
    }

    private val discoveryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != BluetoothDevice.ACTION_FOUND) return
            val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            }
            device?.let { addDevice(it) }
        }
    }

    private val bleScanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            addDevice(result.device)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            results.forEach { addDevice(it.device) }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.w(TAG, "BLE scan failed with code $errorCode")
            bleScanRunning = false
            runOnUiThread {
                selectorDialog?.setMessage(
                    "BLE scan failed (${bleScanError(errorCode)}). Trying Bluetooth Classic..."
                )
                startClassicDiscovery()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))

        printer = PrinterController(this) { status ->
            if (::bridge.isInitialized) bridge.sendStatus(status.toJson())
        }
        bridge = WebPrinterBridge(webView, this)
        configureWebView()
        loadIntentOrStaffPage(intent)
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun configureWebView() {
        val debuggable = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            javaScriptCanOpenWindowsAutomatically = false
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.settings.safeBrowsingEnabled = true
        }

        webView.addJavascriptInterface(bridge, "ElimNativePrinter")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleNavigation(request.url)
            }

            @Deprecated("Used for Android versions below API 24")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleNavigation(Uri.parse(url))
            }

            override fun onPageFinished(view: WebView, url: String) {
                bridge.sendStatus(currentStatus())
            }
        }
    }

    private fun handleNavigation(uri: Uri): Boolean {
        if (isAuthCallback(uri)) {
            webView.loadUrl(authCallbackToStaffUrl(uri))
            return true
        }
        if (isAllowedWebUrl(uri)) return false

        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (error: Exception) {
            Toast.makeText(this, "Blocked unsupported link.", Toast.LENGTH_SHORT).show()
        }
        return true
    }

    private fun loadIntentOrStaffPage(sourceIntent: Intent?) {
        val uri = sourceIntent?.data
        webView.loadUrl(if (uri != null && isAuthCallback(uri)) authCallbackToStaffUrl(uri) else STAFF_URL)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadIntentOrStaffPage(intent)
    }

    private fun isAllowedWebUrl(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host == STAFF_HOST && uri.path.orEmpty().startsWith(STAFF_PATH)

    private fun isAuthCallback(uri: Uri): Boolean = uri.scheme == AUTH_SCHEME && uri.host == AUTH_HOST

    private fun authCallbackToStaffUrl(uri: Uri): String = buildString {
        append(STAFF_URL)
        uri.encodedQuery?.let { append('?').append(it) }
        uri.encodedFragment?.let { append('#').append(it) }
    }

    override fun selectAndConnect(requestId: String) {
        runOnUiThread {
            pendingConnectRequestId = requestId
            if (!hasBluetoothPermissions()) {
                requestPermissions(REQUIRED_PERMISSIONS, BLUETOOTH_PERMISSION_REQUEST)
            } else {
                openSystemDeviceSelector()
            }
        }
    }

    override fun disconnect(requestId: String) {
        printer.disconnect()
        bridge.resolve(requestId, true, status = currentStatus())
    }

    override fun isPrinterConnected(): Boolean = printer.isConnected()

    override fun print(requestId: String, data: ByteArray) {
        if (data.isEmpty()) {
            bridge.resolve(requestId, false, "The receipt payload is empty.", currentStatus())
            return
        }
        printer.print(data) { result ->
            bridge.resolve(
                requestId,
                result.isSuccess,
                result.exceptionOrNull()?.message,
                currentStatus()
            )
        }
    }

    override fun currentStatus(): JSONObject = printer.currentStatus().toJson()

    private fun PrinterController.PrinterStatus.toJson(): JSONObject = JSONObject()
        .put("state", state)
        .put("deviceName", deviceName)
        .put("message", message)

    private fun hasBluetoothPermissions(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return REQUIRED_PERMISSIONS.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != BLUETOOTH_PERMISSION_REQUEST) return
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            openSystemDeviceSelector()
        } else {
            val requestId = pendingConnectRequestId ?: return
            pendingConnectRequestId = null
            bridge.resolve(
                requestId,
                false,
                "Nearby devices permission is required to select and connect the printer.",
                currentStatus()
            )
        }
    }

    private fun openSystemDeviceSelector() {
        val requestId = pendingConnectRequestId ?: return
        val adapter = bluetoothAdapter
        if (adapter == null) {
            pendingConnectRequestId = null
            bridge.resolve(requestId, false, "This tablet has no Bluetooth adapter.", currentStatus())
            return
        }
        if (!adapter.isEnabled) {
            pendingConnectRequestId = null
            bridge.resolve(requestId, false, "Turn on Bluetooth in Android settings, then try Connect again.", currentStatus())
            startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            return
        }

        val manager = getSystemService(CompanionDeviceManager::class.java)
        if (manager == null) {
            openDeviceSelector()
            return
        }

        val request = AssociationRequest.Builder()
            .addDeviceFilter(BluetoothLeDeviceFilter.Builder().build())
            .addDeviceFilter(BluetoothDeviceFilter.Builder().build())
            .setSingleDevice(false)
            .build()

        val callback = object : CompanionDeviceManager.Callback() {
            override fun onAssociationPending(intentSender: IntentSender) {
                launchCompanionSelector(intentSender)
            }

            @Deprecated("Used on Android 12L and below")
            override fun onDeviceFound(intentSender: IntentSender) {
                launchCompanionSelector(intentSender)
            }

            override fun onAssociationCreated(associationInfo: AssociationInfo) {
                runOnUiThread {
                    completeCompanionSelection(associationInfo)
                }
            }

            override fun onFailure(error: CharSequence?) {
                runOnUiThread {
                    pendingConnectRequestId = null
                    bridge.resolve(
                        requestId,
                        false,
                        "Android device selection failed: ${error ?: "unknown error"}",
                        currentStatus()
                    )
                }
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                manager.associate(request, mainExecutor, callback)
            } else {
                @Suppress("DEPRECATION")
                manager.associate(request, callback, null)
            }
        } catch (error: Exception) {
            pendingConnectRequestId = null
            bridge.resolve(
                requestId,
                false,
                "Could not open Android device selection: ${error.message ?: "unknown error"}",
                currentStatus()
            )
        }
    }

    private fun launchCompanionSelector(intentSender: IntentSender) {
        try {
            startIntentSenderForResult(intentSender, COMPANION_DEVICE_REQUEST, null, 0, 0, 0)
        } catch (error: IntentSender.SendIntentException) {
            val requestId = pendingConnectRequestId ?: return
            pendingConnectRequestId = null
            bridge.resolve(
                requestId,
                false,
                "Could not show Android device selection: ${error.message ?: "unknown error"}",
                currentStatus()
            )
        }
    }

    @Deprecated("Activity result compatibility for the system companion-device selector")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != COMPANION_DEVICE_REQUEST) return

        // Android 13+ normally completes through onAssociationCreated().
        if (pendingConnectRequestId == null) return
        val requestId = pendingConnectRequestId ?: return
        if (resultCode != RESULT_OK || data == null) {
            pendingConnectRequestId = null
            bridge.resolve(requestId, false, "Printer selection was cancelled.", currentStatus())
            return
        }

        try {
            val association = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                data.getParcelableExtra(
                    CompanionDeviceManager.EXTRA_ASSOCIATION,
                    AssociationInfo::class.java
                )
            } else {
                null
            }
            if (association != null) {
                completeCompanionSelection(association)
                return
            }

            val device = legacySelectedCompanionDevice(data)
            if (device == null) {
                pendingConnectRequestId = null
                bridge.resolve(requestId, false, "Android did not return a Bluetooth device.", currentStatus())
                return
            }

            pendingConnectRequestId = null
            connectSelectedDevice(requestId, device)
        } catch (error: Exception) {
            pendingConnectRequestId = null
            Log.e(TAG, "Could not read selected companion device", error)
            bridge.resolve(
                requestId,
                false,
                "Could not read selected printer: ${error.message ?: error.javaClass.simpleName}",
                currentStatus()
            )
        }
    }

    @SuppressLint("MissingPermission")
    private fun completeCompanionSelection(association: AssociationInfo) {
        val requestId = pendingConnectRequestId ?: return
        try {
            val device = selectedCompanionDevice(association)
            if (device == null) {
                pendingConnectRequestId = null
                bridge.resolve(requestId, false, "Android associated the device but returned no Bluetooth details.", currentStatus())
                return
            }
            pendingConnectRequestId = null
            connectSelectedDevice(requestId, device)
        } catch (error: Exception) {
            pendingConnectRequestId = null
            Log.e(TAG, "Could not complete companion-device selection", error)
            bridge.resolve(
                requestId,
                false,
                "Could not use selected printer: ${error.message ?: error.javaClass.simpleName}",
                currentStatus()
            )
        }
    }

    @SuppressLint("MissingPermission")
    private fun selectedCompanionDevice(association: AssociationInfo): BluetoothDevice? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val associated = association.associatedDevice
            associated?.bluetoothDevice?.let { return it }
            associated?.bleDevice?.device?.let { return it }
        }

        val address = association.deviceMacAddress?.toString()
        return address?.takeIf { it.isNotBlank() }?.let { bluetoothAdapter?.getRemoteDevice(it) }
    }

    private fun legacySelectedCompanionDevice(data: Intent): BluetoothDevice? {
        @Suppress("DEPRECATION")
        return when (val selected = data.getParcelableExtra<android.os.Parcelable>(CompanionDeviceManager.EXTRA_DEVICE)) {
            is BluetoothDevice -> selected
            is ScanResult -> selected.device
            else -> null
        }
    }

    private fun connectSelectedDevice(requestId: String, device: BluetoothDevice) {
        try {
            printer.connect(device) { result ->
                bridge.resolve(
                    requestId,
                    result.isSuccess,
                    result.exceptionOrNull()?.message,
                    currentStatus()
                )
            }
        } catch (error: Exception) {
            Log.e(TAG, "Printer connection could not start", error)
            bridge.resolve(
                requestId,
                false,
                "Printer connection could not start: ${error.message ?: error.javaClass.simpleName}",
                currentStatus()
            )
        }
    }

    @SuppressLint("MissingPermission")
    private fun openDeviceSelector() {
        val adapter = bluetoothAdapter
        val requestId = pendingConnectRequestId ?: return
        if (adapter == null) {
            pendingConnectRequestId = null
            bridge.resolve(requestId, false, "This tablet has no Bluetooth adapter.", currentStatus())
            return
        }
        if (!adapter.isEnabled) {
            pendingConnectRequestId = null
            bridge.resolve(requestId, false, "Turn on Bluetooth in Android settings, then try Connect again.", currentStatus())
            startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            return
        }

        discoveredDevices.clear()
        val listAdapter = ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, mutableListOf())
        deviceListAdapter = listAdapter
        adapter.bondedDevices.forEach { addDevice(it) }

        selectorDialog = AlertDialog.Builder(this)
            .setTitle("Select receipt printer")
            .setMessage("Scanning for nearby BLE printers...")
            .setAdapter(listAdapter) { _, position ->
                val device = discoveredDevices.values.elementAtOrNull(position) ?: return@setAdapter
                stopScanning()
                selectorDialog = null
                pendingConnectRequestId = null
                connectSelectedDevice(requestId, device)
            }
            .setNegativeButton("Cancel") { _, _ ->
                pendingConnectRequestId = null
                bridge.resolve(requestId, false, "Printer selection was cancelled.", currentStatus())
            }
            .setNeutralButton("Scan again", null)
            .create()
        selectorDialog?.setOnDismissListener { stopScanning() }
        selectorDialog?.show()
        selectorDialog?.getButton(AlertDialog.BUTTON_NEUTRAL)?.setOnClickListener {
            restartScanning(adapter)
        }
        startScanning(adapter)
    }

    @SuppressLint("MissingPermission")
    private fun startScanning(adapter: BluetoothAdapter) {
        if (!receiverRegistered) {
            val filter = IntentFilter(BluetoothDevice.ACTION_FOUND)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(discoveryReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(discoveryReceiver, filter)
            }
            receiverRegistered = true
        }

        var bleStarted = false
        try {
            val scanner = adapter.bluetoothLeScanner
            if (scanner != null) {
                val settings = ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build()
                scanner.startScan(null, settings, bleScanCallback)
                bleScanRunning = true
                bleStarted = true
                Log.i(TAG, "Started low-latency BLE scan")
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not start BLE scan", error)
        }

        if (bleStarted) {
            scanHandler.postDelayed(classicScanFallback, CLASSIC_FALLBACK_DELAY_MS)
        } else {
            selectorDialog?.setMessage("BLE scanning is unavailable. Scanning Bluetooth Classic devices...")
            startClassicDiscovery()
        }
        scanHandler.postDelayed(emptyScanNotice, EMPTY_SCAN_NOTICE_DELAY_MS)
    }

    @SuppressLint("MissingPermission")
    private fun startClassicDiscovery() {
        val adapter = bluetoothAdapter ?: return
        if (adapter.isDiscovering) return
        try {
            val started = adapter.startDiscovery()
            Log.i(TAG, "Classic Bluetooth discovery started=$started")
            if (!started && discoveredDevices.isEmpty()) {
                selectorDialog?.setMessage(
                    "Bluetooth scan could not start. Check Nearby devices permission, then tap Scan again."
                )
            } else if (discoveredDevices.isEmpty()) {
                selectorDialog?.setMessage("Scanning BLE and Bluetooth Classic devices...")
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not start Classic Bluetooth discovery", error)
            selectorDialog?.setMessage("Bluetooth scan error: ${error.message ?: "unknown error"}")
        }
    }

    private fun restartScanning(adapter: BluetoothAdapter) {
        stopScanning()
        discoveredDevices.clear()
        deviceListAdapter?.clear()
        selectorDialog?.setMessage("Scanning for nearby BLE printers...")
        startScanning(adapter)
    }

    @SuppressLint("MissingPermission")
    private fun stopScanning() {
        scanHandler.removeCallbacks(classicScanFallback)
        scanHandler.removeCallbacks(emptyScanNotice)
        try {
            bluetoothAdapter?.cancelDiscovery()
            if (bleScanRunning) {
                bluetoothAdapter?.bluetoothLeScanner?.stopScan(bleScanCallback)
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not stop Bluetooth scan", error)
        }
        bleScanRunning = false
        if (receiverRegistered) {
            try {
                unregisterReceiver(discoveryReceiver)
            } catch (_: IllegalArgumentException) {
            }
            receiverRegistered = false
        }
    }

    @SuppressLint("MissingPermission")
    private fun addDevice(device: BluetoothDevice) {
        runOnUiThread {
            val address = try { device.address } catch (_: SecurityException) { return@runOnUiThread }
            if (discoveredDevices.putIfAbsent(address, device) != null) return@runOnUiThread
            val name = try { device.name } catch (_: SecurityException) { null }
            val bond = if (device.bondState == BluetoothDevice.BOND_BONDED) "Paired" else "Nearby"
            val kind = when (device.type) {
                BluetoothDevice.DEVICE_TYPE_LE -> "BLE"
                BluetoothDevice.DEVICE_TYPE_CLASSIC -> "Classic"
                BluetoothDevice.DEVICE_TYPE_DUAL -> "BLE + Classic"
                else -> "Bluetooth"
            }
            deviceListAdapter?.add("${name?.takeIf { it.isNotBlank() } ?: "Unnamed device"}\n$bond · $kind · $address")
            deviceListAdapter?.notifyDataSetChanged()
            selectorDialog?.setMessage("Select a nearby receipt printer.")
        }
    }

    private fun bleScanError(errorCode: Int): String = when (errorCode) {
        ScanCallback.SCAN_FAILED_ALREADY_STARTED -> "scan already started"
        ScanCallback.SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "scanner registration failed"
        ScanCallback.SCAN_FAILED_INTERNAL_ERROR -> "internal scanner error"
        ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED -> "BLE scan unsupported"
        ScanCallback.SCAN_FAILED_OUT_OF_HARDWARE_RESOURCES -> "scanner resources unavailable"
        ScanCallback.SCAN_FAILED_SCANNING_TOO_FREQUENTLY -> "scanning too frequently"
        else -> "code $errorCode"
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        stopScanning()
        printer.disconnect()
        webView.removeJavascriptInterface("ElimNativePrinter")
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "ElimPrinterApp"
        private const val STAFF_HOST = "sjhwseon-creator.github.io"
        private const val STAFF_PATH = "/Elim-cafe/"
        private const val STAFF_URL = "https://sjhwseon-creator.github.io/Elim-cafe/staff.html"
        private const val AUTH_SCHEME = "elimcafe"
        private const val AUTH_HOST = "auth"
        private const val BLUETOOTH_PERMISSION_REQUEST = 1001
        private const val COMPANION_DEVICE_REQUEST = 1002
        private const val CLASSIC_FALLBACK_DELAY_MS = 6_000L
        private const val EMPTY_SCAN_NOTICE_DELAY_MS = 15_000L
        private val REQUIRED_PERMISSIONS = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }
}
