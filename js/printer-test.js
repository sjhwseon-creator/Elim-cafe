(function initializePrinterTestMode() {
  const statusElement = document.querySelector("#printer-status");
  const statusText = document.querySelector("#printer-status-text");
  const messageElement = document.querySelector("#printer-message");
  const connectButton = document.querySelector("#printer-connect");
  const disconnectButton = document.querySelector("#printer-disconnect");
  const testPrintButton = document.querySelector("#printer-test-print");
  const t = (key, variables = {}) => window.ELIM_STAFF_I18N?.t(key, variables) || key;
  let currentStatus = { state: "unavailable" };

  if (!statusElement || !window.elimPrinter || !window.elimReceipt) return;

  function setMessage(message, isError = false) {
    messageElement.textContent = message;
    messageElement.classList.toggle("error", isError);
  }

  function renderStatus(status) {
    currentStatus = status;
    const state = status.state || "unavailable";
    statusElement.className = `printer-status ${state}`;
    const stateLabel = t(`printer.state.${state}`);
    statusText.textContent = status.deviceName
      ? `${stateLabel} · ${status.deviceName}`
      : stateLabel;

    const connected = state === "connected";
    const busy = state === "connecting" || state === "printing";
    connectButton.disabled = !window.elimPrinter.isAvailable() || connected || busy;
    disconnectButton.disabled = !connected || busy;
    testPrintButton.disabled = !connected || busy;

    if (status.message) setMessage(status.message, state === "error");
  }

  connectButton.addEventListener("click", async () => {
    setMessage(t("printer.opening"));
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
    setMessage(t("printer.testing"));

    try {
      await window.elimPrinter.print(window.elimReceipt.buildTestReceiptBytes());
      renderStatus({ state: "connected", message: t("printer.testSuccess") });
    } catch (error) {
      console.error("Test print failed:", error);
      renderStatus({ state: "error", message: error.message });
    }
  });

  window.elimPrinter.onStatus(renderStatus);
  document.addEventListener("elim:staff-languagechange", () => renderStatus(currentStatus));
  window.elimPrinter.getStatus().catch((error) => {
    renderStatus({ state: "error", message: error.message });
  });
})();
