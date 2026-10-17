(function initializeReceiptBuilder() {
  const ESC = 0x1b;
  const RECEIPT_COLUMNS = 32;
  const PAYMENT_LABELS = {
    paypal: "PayPal",
    sepa: "SEPA bank transfer",
    cash: "Cash"
  };

  const DEFAULT_SETTINGS = Object.freeze({
    cafe_name: "ELIM CAFE",
    header_text: "",
    footer_text: "Thank you!",
    show_customer_name: true,
    show_order_number: true,
    show_payment_method: true,
    show_order_time: true,
    show_total: true,
    separator_style: "dash"
  });

  function printableText(value, maxLength = 240) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .slice(0, maxLength);
  }

  function normalizeSettings(settings = {}) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    return {
      cafe_name: printableText(merged.cafe_name, 60).trim() || DEFAULT_SETTINGS.cafe_name,
      header_text: printableText(merged.header_text),
      footer_text: printableText(merged.footer_text),
      show_customer_name: Boolean(merged.show_customer_name),
      show_order_number: Boolean(merged.show_order_number),
      show_payment_method: Boolean(merged.show_payment_method),
      show_order_time: Boolean(merged.show_order_time),
      show_total: Boolean(merged.show_total),
      separator_style: ["dash", "solid", "double"].includes(merged.separator_style)
        ? merged.separator_style
        : DEFAULT_SETTINGS.separator_style
    };
  }

  function printerCharacter(character) {
    if (character === "€") return 0xd5;
    const normalized = character.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const code = normalized.charCodeAt(0);
    if (code === 0x0a || code === 0x0d) return code;
    return code >= 32 && code <= 126 ? code : 0x3f;
  }

  function printerBytes(text) {
    return Array.from(text, printerCharacter);
  }

  function center(text) {
    const value = printableText(text, RECEIPT_COLUMNS).trim();
    const left = Math.max(0, Math.floor((RECEIPT_COLUMNS - value.length) / 2));
    return `${" ".repeat(left)}${value}`.slice(0, RECEIPT_COLUMNS);
  }

  function wrapLine(text) {
    const value = printableText(text).trim();
    if (!value) return [""];

    const lines = [];
    let remaining = value;
    while (remaining.length > RECEIPT_COLUMNS) {
      let splitAt = remaining.lastIndexOf(" ", RECEIPT_COLUMNS);
      if (splitAt < 1) splitAt = RECEIPT_COLUMNS;
      lines.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
    return lines;
  }

  function textBlockLines(text, centered = false) {
    return printableText(text)
      .split(/\r?\n/)
      .flatMap(wrapLine)
      .map((line) => (centered ? center(line) : line));
  }

  function separator(style) {
    if (style === "double") return "=".repeat(RECEIPT_COLUMNS);
    if (style === "solid") return "_".repeat(RECEIPT_COLUMNS);
    return "-".repeat(RECEIPT_COLUMNS);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function formatEuro(value) {
    return `€${Number(value || 0).toFixed(2)}`;
  }

  function variantLabel(variant) {
    return variant ? ` ${String(variant).toUpperCase()}` : "";
  }

  function totalLine(total) {
    const label = "Total";
    const amount = formatEuro(total);
    const spaces = Math.max(1, RECEIPT_COLUMNS - label.length - amount.length);
    return `${label}${" ".repeat(spaces)}${amount}`.slice(0, RECEIPT_COLUMNS);
  }

  function buildOrderReceiptLines(order, settings = {}) {
    const resolved = normalizeSettings(settings);
    const divider = separator(resolved.separator_style);
    const lines = textBlockLines(resolved.cafe_name, true);

    if (resolved.header_text.trim()) lines.push(...textBlockLines(resolved.header_text, true));
    lines.push(divider);

    if (resolved.show_order_number) lines.push(`Order #${printableText(order.order_number, 20)}`);
    if (resolved.show_customer_name && order.customer_name) lines.push(...wrapLine(order.customer_name));
    if (resolved.show_order_time) lines.push(formatTime(order.created_at));
    lines.push("");

    (order.order_items || []).forEach((item) => {
      lines.push(...wrapLine(`${item.item_name}${variantLabel(item.variant)} x${item.quantity}`));
    });

    lines.push(divider);
    if (resolved.show_total) lines.push(totalLine(order.total_price));
    if (resolved.show_payment_method) {
      lines.push(PAYMENT_LABELS[order.payment_method] || "Payment not recorded");
    }
    lines.push(divider);

    if (resolved.footer_text.trim()) lines.push(...textBlockLines(resolved.footer_text, true));
    return lines;
  }

  function buildOrderReceiptBytes(order, settings = {}) {
    const text = `${buildOrderReceiptLines(order, settings).join("\n")}\n\n\n\n`;
    return new Uint8Array([
      ESC, 0x40,
      ESC, 0x74, 0x13,
      ESC, 0x61, 0x00,
      ...printerBytes(text)
    ]);
  }

  function buildOrderReceiptPreview(order, settings = {}) {
    return buildOrderReceiptLines(order, settings).join("\n");
  }

  function buildTestReceiptBytes() {
    return new Uint8Array([
      ESC, 0x40,
      ESC, 0x61, 0x01,
      ESC, 0x21, 0x30,
      ...printerBytes("ELIM CAFE\n"),
      ESC, 0x21, 0x00,
      ...printerBytes("TEST PRINT\n"),
      ...printerBytes("-".repeat(RECEIPT_COLUMNS)),
      0x0a, 0x0a, 0x0a, 0x0a
    ]);
  }

  window.elimReceipt = {
    columns: RECEIPT_COLUMNS,
    defaultSettings: DEFAULT_SETTINGS,
    normalizeSettings,
    buildOrderReceiptLines,
    buildOrderReceiptPreview,
    buildOrderReceiptBytes,
    buildTestReceiptBytes
  };
})();
