(function initializeReceiptBuilder() {
  const ESC = 0x1b;
  const RECEIPT_COLUMNS = 32;

  function asciiBytes(text) {
    return Array.from(text, (character) => {
      const code = character.charCodeAt(0);
      if (code === 0x0a || code === 0x0d) return code;
      return code >= 32 && code <= 126 ? code : 0x3f;
    });
  }

  function buildTestReceiptBytes() {
    return new Uint8Array([
      ESC, 0x40,
      ESC, 0x61, 0x01,
      ESC, 0x21, 0x30,
      ...asciiBytes("ELIM CAFE\n"),
      ESC, 0x21, 0x00,
      ...asciiBytes("TEST PRINT\n"),
      ...asciiBytes("-".repeat(RECEIPT_COLUMNS)),
      0x0a, 0x0a, 0x0a, 0x0a
    ]);
  }

  window.elimReceipt = {
    columns: RECEIPT_COLUMNS,
    buildTestReceiptBytes
  };
})();
