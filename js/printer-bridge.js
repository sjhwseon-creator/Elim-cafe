(function initializePrinterBridge() {
  const REQUEST_TIMEOUT_MS = 45000;
  const pendingRequests = new Map();
  const statusListeners = new Set();
  const nativeBridge = window.ElimNativePrinter;
  let status = nativeBridge
    ? { state: "disconnected", deviceName: "", message: "Android print bridge ready." }
    : { state: "unavailable", deviceName: "", message: "Open this dashboard in the Elim Android print app." };

  function notifyStatus(nextStatus) {
    status = { ...status, ...nextStatus };
    statusListeners.forEach((listener) => listener({ ...status }));
  }

  function createRequestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `printer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 8192;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return window.btoa(binary);
  }

  function callNative(method, payload = {}) {
    if (!nativeBridge || typeof nativeBridge[method] !== "function") {
      return Promise.reject(new Error("Android print bridge is unavailable."));
    }

    const requestId = createRequestId();

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error("Printer bridge request timed out."));
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(requestId, { resolve, reject, timeoutId });

      try {
        nativeBridge[method](requestId, JSON.stringify(payload));
      } catch (error) {
        window.clearTimeout(timeoutId);
        pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  window.elimPrinterNativeResult = function handleNativeResult(requestId, resultJson) {
    const request = pendingRequests.get(requestId);
    if (!request) return;

    window.clearTimeout(request.timeoutId);
    pendingRequests.delete(requestId);

    try {
      const result = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
      if (result?.status) notifyStatus(result.status);

      if (result?.ok === false) {
        request.reject(new Error(result.error || "Printer operation failed."));
      } else {
        request.resolve(result || { ok: true });
      }
    } catch (error) {
      request.reject(new Error(`Invalid printer bridge response: ${error.message}`));
    }
  };

  window.elimPrinterNativeStatus = function handleNativeStatus(statusJson) {
    try {
      const nextStatus = typeof statusJson === "string" ? JSON.parse(statusJson) : statusJson;
      notifyStatus(nextStatus);
    } catch (error) {
      console.error("Invalid printer status from Android bridge:", error);
    }
  };

  window.elimPrinter = {
    isAvailable() {
      return Boolean(nativeBridge);
    },

    getStatus() {
      if (!nativeBridge) return Promise.resolve({ ...status });
      return callNative("getStatus");
    },

    async connect() {
      notifyStatus({ state: "connecting", message: "Select and connect a receipt printer." });
      return callNative("connect");
    },

    async disconnect() {
      const result = await callNative("disconnect");
      notifyStatus({ state: "disconnected", deviceName: "", message: "Printer disconnected." });
      return result;
    },

    async print(bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError("Printer data must be a Uint8Array.");
      }

      notifyStatus({ state: "printing", message: "Sending test receipt..." });
      return callNative("printBase64", { data: bytesToBase64(bytes) });
    },

    onStatus(listener) {
      statusListeners.add(listener);
      listener({ ...status });
      return () => statusListeners.delete(listener);
    }
  };
})();
