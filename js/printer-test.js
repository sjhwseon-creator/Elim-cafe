(function initializePrinterTestMode() {
  const statusElement = document.querySelector("#printer-status");
  const statusText = document.querySelector("#printer-status-text");
  const messageElement = document.querySelector("#printer-message");
  const connectButton = document.querySelector("#printer-connect");
  const disconnectButton = document.querySelector("#printer-disconnect");
  const testPrintButton = document.querySelector("#printer-test-print");

  if (!statusElement || !window.elimPrinter || !window.elimReceipt) return;

  function setMessage(message, isError = false) {
    messageElement.textContent = message;
    messageElement.classList.toggle("error", isError);
  }

  function renderStatus(status) {
    const state = status.state || "unavailable";
    statusElement.className = `printer-status ${state}`;
    statusText.textContent = status.deviceName
      ? `${state.charAt(0).toUpperCase() + state.slice(1)} · ${status.deviceName}`
      : state.charAt(0).toUpperCase() + state.slice(1);

    const connected = state === "connected";
    const busy = state === "connecting" || state === "printing";
    connectButton.disabled = !window.elimPrinter.isAvailable() || connected || busy;
    disconnectButton.disabled = !connected || busy;
    testPrintButton.disabled = !connected || busy;

    if (status.message) setMessage(status.message, state === "error");
  }

  connectButton.addEventListener("click", async () => {
    setMessage("Opening the Android printer selector...");
    try {
      await window.elimPrinter.connect();
    } catch (error) {
      console.error("Printer connection failed:", error);
      renderStatus({ state: "error", message: error.message });
    }
  });

  disconnectButton.addEventListener("click", async () => {
    try {
      await window.elimPrinter.disconnect();
    } catch (error) {
      console.error("Printer disconnect failed:", error);
      renderStatus({ state: "error", message: error.message });
    }
  });

  testPrintButton.addEventListener("click", async () => {
    testPrintButton.disabled = true;
    setMessage("Printing ELIM CAFE test receipt...");

    try {
      await window.elimPrinter.print(window.elimReceipt.buildTestReceiptBytes());
      renderStatus({ state: "connected", message: "Test receipt printed." });
    } catch (error) {
      console.error("Test print failed:", error);
      renderStatus({ state: "error", message: error.message });
    }
  });

  window.elimPrinter.onStatus(renderStatus);
  window.elimPrinter.getStatus().catch((error) => {
    renderStatus({ state: "error", message: error.message });
  });
})();
