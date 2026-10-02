package de.elimcafe.printerbridge.web

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class WebPrinterBridge(
    private val webView: WebView,
    private val host: Host
) {
    interface Host {
        fun selectAndConnect(requestId: String)
        fun disconnect(requestId: String)
        fun isPrinterConnected(): Boolean
        fun print(requestId: String, data: ByteArray)
        fun currentStatus(): JSONObject
    }

    @JavascriptInterface
    fun connect(requestId: String, payloadJson: String) {
        host.selectAndConnect(requestId)
    }

    @JavascriptInterface
    fun disconnect(requestId: String, payloadJson: String) {
        host.disconnect(requestId)
    }

    @JavascriptInterface
    fun isConnected(): Boolean = host.isPrinterConnected()

    @JavascriptInterface
    fun getStatus(requestId: String, payloadJson: String) {
        resolve(requestId, true, status = host.currentStatus())
    }

    @JavascriptInterface
    fun printBase64(requestId: String, payloadJson: String) {
        printReceipt(requestId, payloadJson)
    }

    @JavascriptInterface
    fun printReceipt(requestId: String, base64OrJsonPayload: String) {
        try {
            val data = if (base64OrJsonPayload.trimStart().startsWith("{")) {
                JSONObject(base64OrJsonPayload).getString("data")
            } else {
                base64OrJsonPayload
            }
            host.print(requestId, android.util.Base64.decode(data, android.util.Base64.DEFAULT))
        } catch (error: Exception) {
            resolve(requestId, false, "Invalid print payload: ${error.message}")
        }
    }

    fun resolve(
        requestId: String,
        ok: Boolean,
        error: String? = null,
        status: JSONObject? = null
    ) {
        val result = JSONObject().put("ok", ok)
        error?.let { result.put("error", it) }
        status?.let { result.put("status", it) }
        evaluate("window.elimPrinterNativeResult(${JSONObject.quote(requestId)}, ${JSONObject.quote(result.toString())})")
    }

    fun sendStatus(status: JSONObject) {
        evaluate("window.elimPrinterNativeStatus(${JSONObject.quote(status.toString())})")
    }

    private fun evaluate(script: String) {
        webView.post { webView.evaluateJavascript(script, null) }
    }
}
