(function initializeReceiptBuilder() {
  const ESC = 0x1b;
  const GS = 0x1d;
  const RECEIPT_COLUMNS = 32;
  const CATEGORY_ORDER = ["Coffee", "Latte", "Ade", "Other"];
  const PAYMENT_LABELS = { paypal: "PayPal", sepa: "SEPA bank transfer", cash: "Cash" };

  const DEFAULT_SETTINGS = Object.freeze({
    cafe_name: "ELIM CAFE",
    header_text: "",
    footer_text: "Thank you!",
    custom_text: "",
    show_customer_name: true,
    show_order_number: true,
    show_payment_method: true,
    show_order_time: true,
    show_total: true,
    show_category: true,
    show_category_subtotal: true,
    separator_style: "dash",
    cafe_name_size: 2,
    category_size: 2,
    details_size: 1,
    items_size: 2,
    summary_size: 1,
    footer_size: 1,
    custom_text_size: 1,
    cafe_name_align: "center",
    category_align: "center",
    details_align: "left",
    items_align: "left",
    summary_align: "left",
    footer_align: "center",
    custom_text_align: "center",
    category_bold: true,
    items_bold: true
  });

  function printableText(value, maxLength = 240) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .slice(0, maxLength);
  }

  function normalizedSize(value, maximum = 3) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : 1;
  }

  function normalizedAlign(value, fallback = "left") {
    return ["left", "center", "right"].includes(value) ? value : fallback;
  }

  function normalizeSettings(settings = {}) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    return {
      cafe_name: printableText(merged.cafe_name, 60).trim() || DEFAULT_SETTINGS.cafe_name,
      header_text: printableText(merged.header_text),
      footer_text: printableText(merged.footer_text),
      custom_text: printableText(merged.custom_text),
      show_customer_name: Boolean(merged.show_customer_name),
      show_order_number: Boolean(merged.show_order_number),
      show_payment_method: Boolean(merged.show_payment_method),
      show_order_time: Boolean(merged.show_order_time),
      show_total: Boolean(merged.show_total),
      show_category: Boolean(merged.show_category),
      show_category_subtotal: Boolean(merged.show_category_subtotal),
      separator_style: ["dash", "solid", "double"].includes(merged.separator_style) ? merged.separator_style : DEFAULT_SETTINGS.separator_style,
      cafe_name_size: normalizedSize(merged.cafe_name_size),
      category_size: normalizedSize(merged.category_size),
      details_size: normalizedSize(merged.details_size, 2),
      items_size: normalizedSize(merged.items_size),
      summary_size: normalizedSize(merged.summary_size, 2),
      footer_size: normalizedSize(merged.footer_size, 2),
      custom_text_size: normalizedSize(merged.custom_text_size, 2),
      cafe_name_align: normalizedAlign(merged.cafe_name_align, "center"),
      category_align: normalizedAlign(merged.category_align, "center"),
      details_align: normalizedAlign(merged.details_align),
      items_align: normalizedAlign(merged.items_align),
      summary_align: normalizedAlign(merged.summary_align),
      footer_align: normalizedAlign(merged.footer_align, "center"),
      custom_text_align: normalizedAlign(merged.custom_text_align, "center"),
      category_bold: Boolean(merged.category_bold),
      items_bold: Boolean(merged.items_bold)
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

  function columnsForSize(size) {
    return Math.max(8, Math.floor(RECEIPT_COLUMNS / normalizedSize(size)));
  }

  function wrapLine(text, columns) {
    const value = printableText(text).trim();
    if (!value) return [""];
    const lines = [];
    let remaining = value;
    while (remaining.length > columns) {
      let splitAt = remaining.lastIndexOf(" ", columns);
      if (splitAt < 1) splitAt = columns;
      lines.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
    return lines;
  }

  function row(text, options = {}) {
    return {
      text: printableText(text),
      size: normalizedSize(options.size),
      bold: Boolean(options.bold),
      align: normalizedAlign(options.align)
    };
  }

  function textRows(text, options = {}) {
    const size = normalizedSize(options.size);
    return printableText(text)
      .split(/\r?\n/)
      .flatMap((line) => wrapLine(line, columnsForSize(size)))
      .map((line) => row(line, options));
  }

  function separator(style) {
    if (style === "double") return "=".repeat(RECEIPT_COLUMNS);
    if (style === "solid") return "_".repeat(RECEIPT_COLUMNS);
    return "-".repeat(RECEIPT_COLUMNS);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }

  function formatEuro(value) {
    return `€${Number(value || 0).toFixed(2)}`;
  }

  function variantLabel(variant) {
    return variant ? ` ${String(variant).toUpperCase()}` : "";
  }

  function categoryName(value) {
    return printableText(value, 40).trim() || "Other";
  }

  function groupOrderItems(order) {
    const groups = new Map();
    (order.order_items || []).forEach((item) => {
      const category = categoryName(item.category);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    });
    return Array.from(groups.entries())
      .sort(([left], [right]) => {
        const li = CATEGORY_ORDER.indexOf(left);
        const ri = CATEGORY_ORDER.indexOf(right);
        const leftRank = li === -1 ? CATEGORY_ORDER.length : li;
        const rightRank = ri === -1 ? CATEGORY_ORDER.length : ri;
        return leftRank - rightRank || left.localeCompare(right);
      })
      .map(([category, items]) => ({ category, items }));
  }

  function categorySubtotal(items) {
    return items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
  }

  function totalLine(label, total, size) {
    const amount = formatEuro(total);
    const columns = columnsForSize(size);
    return `${label}${" ".repeat(Math.max(1, columns - label.length - amount.length))}${amount}`.slice(0, columns);
  }

  function buildCategoryReceiptRows(order, category, items, settings = {}) {
    const resolved = normalizeSettings(settings);
    const rows = [];
    const divider = separator(resolved.separator_style);
    rows.push(...textRows(resolved.cafe_name, { size: resolved.cafe_name_size, bold: true, align: resolved.cafe_name_align }));
    if (resolved.header_text.trim()) rows.push(...textRows(resolved.header_text, { align: "center" }));
    rows.push(row(divider));

    if (resolved.show_category) {
      rows.push(...textRows(category.toUpperCase(), { size: resolved.category_size, bold: resolved.category_bold, align: resolved.category_align }));
      rows.push(row(divider));
    }

    const detailOptions = { size: resolved.details_size, align: resolved.details_align };
    if (resolved.show_order_number) rows.push(...textRows(`Order #${printableText(order.order_number, 20)}`, detailOptions));
    if (resolved.show_customer_name && order.customer_name) rows.push(...textRows(order.customer_name, detailOptions));
    if (resolved.show_order_time) rows.push(...textRows(formatTime(order.created_at), detailOptions));
    rows.push(row(""));

    items.forEach((item) => {
      rows.push(...textRows(`${item.item_name}${variantLabel(item.variant)} x${item.quantity}`, {
        size: resolved.items_size,
        bold: resolved.items_bold,
        align: resolved.items_align
      }));
    });

    rows.push(row(divider));
    const summaryOptions = { size: resolved.summary_size, align: resolved.summary_align };
    if (resolved.show_category_subtotal) rows.push(row(totalLine("Subtotal", categorySubtotal(items), resolved.summary_size), summaryOptions));
    if (resolved.show_total) rows.push(row(totalLine("Order total", order.total_price, resolved.summary_size), summaryOptions));
    if (resolved.show_payment_method) rows.push(...textRows(PAYMENT_LABELS[order.payment_method] || "Payment not recorded", summaryOptions));
    rows.push(row(divider));

    if (resolved.custom_text.trim()) rows.push(...textRows(resolved.custom_text, { size: resolved.custom_text_size, align: resolved.custom_text_align }));
    if (resolved.footer_text.trim()) rows.push(...textRows(resolved.footer_text, { size: resolved.footer_size, align: resolved.footer_align }));
    return rows;
  }

  function alignmentByte(align) {
    if (align === "center") return 0x01;
    if (align === "right") return 0x02;
    return 0x00;
  }

  function rowsToBytes(rows) {
    const bytes = [ESC, 0x40, ESC, 0x74, 0x13];
    rows.forEach((entry) => {
      const multiplier = normalizedSize(entry.size) - 1;
      bytes.push(
        ESC, 0x61, alignmentByte(entry.align),
        ESC, 0x45, entry.bold ? 0x01 : 0x00,
        GS, 0x21, (multiplier << 4) | multiplier,
        ...printerBytes(entry.text), 0x0a
      );
    });
    bytes.push(ESC, 0x45, 0x00, GS, 0x21, 0x00, ESC, 0x61, 0x00, 0x0a, 0x0a, 0x0a, 0x0a);
    return new Uint8Array(bytes);
  }

  function buildCategoryReceipts(order, settings = {}) {
    return groupOrderItems(order).map(({ category, items }) => {
      const rows = buildCategoryReceiptRows(order, category, items, settings);
      return { category, items, rows, bytes: rowsToBytes(rows), preview: rows.map((entry) => entry.text).join("\n") };
    });
  }

  function buildOrderReceiptLines(order, settings = {}) {
    return buildCategoryReceipts(order, settings).flatMap((receipt, index) => [
      ...(index ? [""] : []),
      ...receipt.rows.map((entry) => entry.text)
    ]);
  }

  // Kept for compatibility with earlier callers. Category-aware callers use buildCategoryReceipts.
  function buildOrderReceiptBytes(order, settings = {}) {
    const receipts = buildCategoryReceipts(order, settings);
    return receipts.length ? receipts[0].bytes : rowsToBytes([]);
  }

  function buildOrderReceiptPreview(order, settings = {}) {
    return buildCategoryReceipts(order, settings).map((receipt) => receipt.preview).join("\n\n");
  }

  function buildTestReceiptBytes() {
    return new Uint8Array([
      ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x21, 0x30,
      ...printerBytes("ELIM CAFE\n"), ESC, 0x21, 0x00,
      ...printerBytes("TEST PRINT\n"), ...printerBytes("-".repeat(RECEIPT_COLUMNS)),
      0x0a, 0x0a, 0x0a, 0x0a
    ]);
  }

  window.elimReceipt = {
    columns: RECEIPT_COLUMNS,
    defaultSettings: DEFAULT_SETTINGS,
    normalizeSettings,
    buildCategoryReceipts,
    buildOrderReceiptLines,
    buildOrderReceiptPreview,
    buildOrderReceiptBytes,
    buildTestReceiptBytes
  };
})();
