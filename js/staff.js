const loginPanel = document.querySelector("#staff-login-panel");
const loginForm = document.querySelector("#staff-login-form");
const staffEmail = document.querySelector("#staff-email");
const staffPassword = document.querySelector("#staff-password");
const staffSignIn = document.querySelector("#staff-sign-in");
const loginMessage = document.querySelector("#login-message");
const staffDashboard = document.querySelector("#staff-dashboard");
const staffLogout = document.querySelector("#staff-logout");
const ordersList = document.querySelector("#orders-list");
const staffMessage = document.querySelector("#staff-message");
const refreshOrders = document.querySelector("#refresh-orders");
const printerWarning = document.querySelector("#printer-warning");
const receiptSettingsForm = document.querySelector("#receipt-settings-form");
const receiptSettingsMessage = document.querySelector("#receipt-settings-message");
const receiptPreview = document.querySelector("#receipt-preview");
const receiptPreviewButton = document.querySelector("#receipt-preview-button");
const receiptTestPrint = document.querySelector("#receipt-test-print");

const receiptFields = {
  cafe_name: document.querySelector("#receipt-cafe-name"),
  header_text: document.querySelector("#receipt-header-text"),
  footer_text: document.querySelector("#receipt-footer-text"),
  custom_text: document.querySelector("#receipt-custom-text"),
  separator_style: document.querySelector("#receipt-separator-style"),
  show_customer_name: document.querySelector("#receipt-show-customer"),
  show_order_number: document.querySelector("#receipt-show-order-number"),
  show_payment_method: document.querySelector("#receipt-show-payment"),
  show_order_time: document.querySelector("#receipt-show-time"),
  show_total: document.querySelector("#receipt-show-total"),
  show_category: document.querySelector("#receipt-show-category"),
  show_category_subtotal: document.querySelector("#receipt-show-category-subtotal"),
  cafe_name_size: document.querySelector("#receipt-cafe-name-size"),
  category_size: document.querySelector("#receipt-category-size"),
  details_size: document.querySelector("#receipt-details-size"),
  items_size: document.querySelector("#receipt-items-size"),
  summary_size: document.querySelector("#receipt-summary-size"),
  footer_size: document.querySelector("#receipt-footer-size"),
  custom_text_size: document.querySelector("#receipt-custom-text-size"),
  cafe_name_align: document.querySelector("#receipt-cafe-name-align"),
  category_align: document.querySelector("#receipt-category-align"),
  details_align: document.querySelector("#receipt-details-align"),
  items_align: document.querySelector("#receipt-items-align"),
  summary_align: document.querySelector("#receipt-summary-align"),
  footer_align: document.querySelector("#receipt-footer-align"),
  custom_text_align: document.querySelector("#receipt-custom-text-align"),
  category_bold: document.querySelector("#receipt-category-bold"),
  items_bold: document.querySelector("#receipt-items-bold")
};

const STATUSES = ["new", "preparing", "completed"];
const PAYMENT_LABELS = {
  paypal: "PayPal",
  sepa: "SEPA bank transfer",
  cash: "Cash"
};

let orders = [];
let realtimeChannel = null;
let pendingLoginError = "";
let receiptSettings = { ...window.elimReceipt.defaultSettings };
let receiptSettingsLoaded = false;
let printerConnected = false;
let printQueue = Promise.resolve();
const activePrintIds = new Set();
const queuedPrintIds = new Set();

function formatEuro(value) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatClock(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function statusLabel(status) {
  return String(status || "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function orderItemLabel(item) {
  if (!item.variant) return item.item_name;
  return `${item.item_name} - ${statusLabel(item.variant)}`;
}

function printStatusText(order) {
  if (order.print_status === "printed") {
    return order.printed_at ? `Printed ${formatClock(order.printed_at)}` : "Printed before tracking";
  }
  if (order.print_status === "failed") return `Print failed · ${order.print_attempts} attempt(s)`;
  if (order.print_status === "printing") return "Printing in progress";
  return "Pending print";
}

function showLogin(message = "", isError = false) {
  loginPanel.hidden = false;
  staffDashboard.hidden = true;
  staffLogout.hidden = true;
  setMessage(loginMessage, message, isError);
}

function showDashboard() {
  loginPanel.hidden = true;
  staffDashboard.hidden = false;
  staffLogout.hidden = false;
  setMessage(loginMessage, "");
  updatePrinterWarning();
}

function updatePrinterWarning() {
  printerWarning.hidden = printerConnected;
  receiptTestPrint.disabled = !printerConnected;
}

function renderOrders() {
  if (!orders.length) {
    ordersList.className = "orders-list empty-state";
    ordersList.textContent = "Waiting for orders...";
    return;
  }

  ordersList.className = "orders-list";
  ordersList.innerHTML = orders.map((order) => `
    <article class="order-card">
      <div class="order-topline">
        <h3>Order #${escapeHtml(order.order_number)}</h3>
        <span class="status-badge ${escapeHtml(order.status)}">${statusLabel(order.status)}</span>
      </div>

      <p class="order-meta">${escapeHtml(order.customer_name)} · ${formatTime(order.created_at)}</p>
      <p class="order-payment">Payment: <strong>${escapeHtml(PAYMENT_LABELS[order.payment_method] || "Not recorded")}</strong></p>

      <ul class="order-items">
        ${(order.order_items || []).map((item) => `
          <li>
            <strong>${escapeHtml(item.quantity)} x ${escapeHtml(orderItemLabel(item))}</strong>
            <span>${formatEuro(item.unit_price)}</span>
          </li>
        `).join("")}
      </ul>

      <div class="order-footer">
        <p class="order-total">${formatEuro(order.total_price)}</p>
        <div class="print-state-group">
          <span class="print-status ${escapeHtml(order.print_status)}">${escapeHtml(printStatusText(order))}</span>
          <button
            class="secondary-button small-button reprint-button"
            type="button"
            data-reprint-id="${escapeHtml(order.id)}"
            ${activePrintIds.has(order.id) || queuedPrintIds.has(order.id) ? "disabled" : ""}
          >Reprint</button>
        </div>
      </div>

      <div class="status-actions" aria-label="Update order #${escapeHtml(order.order_number)} status">
        ${STATUSES.map((status) => `
          <button
            class="status-button ${status}"
            type="button"
            data-order-id="${escapeHtml(order.id)}"
            data-status="${status}"
            aria-pressed="${order.status === status}"
          >${statusLabel(status)}</button>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function currentReceiptSettings() {
  return window.elimReceipt.normalizeSettings({
    cafe_name: receiptFields.cafe_name.value,
    header_text: receiptFields.header_text.value,
    footer_text: receiptFields.footer_text.value,
    custom_text: receiptFields.custom_text.value,
    separator_style: receiptFields.separator_style.value,
    show_customer_name: receiptFields.show_customer_name.checked,
    show_order_number: receiptFields.show_order_number.checked,
    show_payment_method: receiptFields.show_payment_method.checked,
    show_order_time: receiptFields.show_order_time.checked,
    show_total: receiptFields.show_total.checked,
    show_category: receiptFields.show_category.checked,
    show_category_subtotal: receiptFields.show_category_subtotal.checked,
    cafe_name_size: receiptFields.cafe_name_size.value,
    category_size: receiptFields.category_size.value,
    details_size: receiptFields.details_size.value,
    items_size: receiptFields.items_size.value,
    summary_size: receiptFields.summary_size.value,
    footer_size: receiptFields.footer_size.value,
    custom_text_size: receiptFields.custom_text_size.value,
    cafe_name_align: receiptFields.cafe_name_align.value,
    category_align: receiptFields.category_align.value,
    details_align: receiptFields.details_align.value,
    items_align: receiptFields.items_align.value,
    summary_align: receiptFields.summary_align.value,
    footer_align: receiptFields.footer_align.value,
    custom_text_align: receiptFields.custom_text_align.value,
    category_bold: receiptFields.category_bold.checked,
    items_bold: receiptFields.items_bold.checked
  });
}

function previewOrder() {
  return orders[0] || {
    order_number: 105,
    customer_name: "Hwan",
    created_at: new Date().toISOString(),
    total_price: 8.5,
    payment_method: "paypal",
    order_items: [
      { category: "Coffee", item_name: "Americano", variant: "hot", quantity: 1, unit_price: 2 },
      { category: "Coffee", item_name: "Americano", variant: "ice", quantity: 1, unit_price: 2.5 },
      { category: "Latte", item_name: "Matcha Latte", variant: "hot", quantity: 1, unit_price: 3 },
      { category: "Ade", item_name: "BLUE Lemon-Ade", variant: null, quantity: 1, unit_price: 1 }
    ]
  };
}

function renderReceiptPreview(settings = currentReceiptSettings()) {
  const receipts = window.elimReceipt.buildCategoryReceipts(previewOrder(), settings);
  receiptPreview.replaceChildren();

  receipts.forEach((receipt) => {
    const ticket = document.createElement("section");
    ticket.className = "receipt-preview-ticket";
    ticket.setAttribute("aria-label", `${receipt.category} receipt`);

    receipt.rows.forEach((entry) => {
      const line = document.createElement("div");
      line.className = `receipt-preview-line size-${entry.size} align-${entry.align}`;
      line.textContent = entry.text || " ";
      line.style.fontWeight = entry.bold ? "800" : "400";
      ticket.append(line);
    });
    receiptPreview.append(ticket);
  });
}

function fillReceiptSettingsForm(settings) {
  receiptFields.cafe_name.value = settings.cafe_name;
  receiptFields.header_text.value = settings.header_text;
  receiptFields.footer_text.value = settings.footer_text;
  receiptFields.custom_text.value = settings.custom_text;
  receiptFields.separator_style.value = settings.separator_style;
  receiptFields.show_customer_name.checked = settings.show_customer_name;
  receiptFields.show_order_number.checked = settings.show_order_number;
  receiptFields.show_payment_method.checked = settings.show_payment_method;
  receiptFields.show_order_time.checked = settings.show_order_time;
  receiptFields.show_total.checked = settings.show_total;
  receiptFields.show_category.checked = settings.show_category;
  receiptFields.show_category_subtotal.checked = settings.show_category_subtotal;
  receiptFields.cafe_name_size.value = settings.cafe_name_size;
  receiptFields.category_size.value = settings.category_size;
  receiptFields.details_size.value = settings.details_size;
  receiptFields.items_size.value = settings.items_size;
  receiptFields.summary_size.value = settings.summary_size;
  receiptFields.footer_size.value = settings.footer_size;
  receiptFields.custom_text_size.value = settings.custom_text_size;
  receiptFields.cafe_name_align.value = settings.cafe_name_align;
  receiptFields.category_align.value = settings.category_align;
  receiptFields.details_align.value = settings.details_align;
  receiptFields.items_align.value = settings.items_align;
  receiptFields.summary_align.value = settings.summary_align;
  receiptFields.footer_align.value = settings.footer_align;
  receiptFields.custom_text_align.value = settings.custom_text_align;
  receiptFields.category_bold.checked = settings.category_bold;
  receiptFields.items_bold.checked = settings.items_bold;
  renderReceiptPreview(settings);
}

async function loadReceiptSettings() {
  const { data, error } = await window.elimSupabase
    .from("receipt_settings")
    .select("cafe_name, header_text, footer_text, custom_text, show_customer_name, show_order_number, show_payment_method, show_order_time, show_total, show_category, show_category_subtotal, separator_style, cafe_name_size, category_size, details_size, items_size, summary_size, footer_size, custom_text_size, cafe_name_align, category_align, details_align, items_align, summary_align, footer_align, custom_text_align, category_bold, items_bold")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Could not load receipt settings:", error);
    receiptSettingsLoaded = false;
    setMessage(receiptSettingsMessage, `Run the printer SQL migration first: ${error.message}`, true);
    fillReceiptSettingsForm(receiptSettings);
    return;
  }

  receiptSettings = window.elimReceipt.normalizeSettings(data);
  receiptSettingsLoaded = true;
  fillReceiptSettingsForm(receiptSettings);
  setMessage(receiptSettingsMessage, "Receipt settings loaded.");
}

async function saveReceiptSettings(event) {
  event.preventDefault();
  const nextSettings = currentReceiptSettings();
  const saveButton = document.querySelector("#receipt-save");
  saveButton.disabled = true;
  setMessage(receiptSettingsMessage, "Saving receipt settings...");

  const { data, error } = await window.elimSupabase
    .from("receipt_settings")
    .update({ ...nextSettings, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();

  saveButton.disabled = false;
  if (error) {
    console.error("Could not save receipt settings:", error);
    setMessage(receiptSettingsMessage, `Could not save settings: ${error.message}`, true);
    return;
  }

  receiptSettings = window.elimReceipt.normalizeSettings(data);
  receiptSettingsLoaded = true;
  fillReceiptSettingsForm(receiptSettings);
  setMessage(receiptSettingsMessage, "Receipt settings saved.");
}

async function isAuthorizedStaff(userId) {
  const { data, error } = await window.elimSupabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "staff")
    .maybeSingle();

  if (error) {
    console.error("Could not verify staff access:", error);
    return false;
  }
  return data?.role === "staff";
}

async function loadOrders({ processPrints = true } = {}) {
  refreshOrders.disabled = true;
  setMessage(staffMessage, "Loading orders...");

  const { data, error } = await window.elimSupabase
    .from("orders")
    .select("id, order_number, customer_name, total_price, payment_method, status, created_at, print_status, printed_at, print_attempts, printing_started_at, order_items(category, item_name, variant, quantity, unit_price)")
    .order("created_at", { ascending: false });

  refreshOrders.disabled = false;
  if (error) {
    console.error("Could not load orders:", error);
    setMessage(staffMessage, `Could not load orders. Run the printer SQL migration first: ${error.message}`, true);
    return;
  }

  orders = data || [];
  setMessage(staffMessage, realtimeChannel ? "Live updates connected." : "");
  renderOrders();
  renderReceiptPreview();
  if (processPrints) queuePendingAutomaticPrints();
}

async function loadOrderForPrint(orderId) {
  const { data, error } = await window.elimSupabase
    .from("orders")
    .select("id, order_number, customer_name, total_price, payment_method, created_at, order_items(category, item_name, variant, quantity, unit_price)")
    .eq("id", orderId)
    .single();

  if (error) throw new Error(`Could not load order for printing: ${error.message}`);
  if (!data.order_items?.length) throw new Error("This order has no items to print.");
  return data;
}

async function claimPrint(orderId, force) {
  const { data, error } = await window.elimSupabase.rpc("claim_order_print", {
    p_order_id: orderId,
    p_force: force
  });
  if (error) throw new Error(`Could not claim print job: ${error.message}`);
  return Boolean(data?.claimed);
}

async function finishPrint(orderId, success) {
  const { data, error } = await window.elimSupabase.rpc("finish_order_print", {
    p_order_id: orderId,
    p_success: success
  });
  if (error) throw new Error(`Could not save print result: ${error.message}`);
  if (!data?.updated) throw new Error("The print job was no longer in the printing state.");
}

async function printOrder(orderId, { force = false, automatic = false } = {}) {
  if (!printerConnected) {
    if (!automatic) setMessage(staffMessage, "Connect the receipt printer before reprinting.", true);
    return;
  }
  if (!receiptSettingsLoaded || activePrintIds.has(orderId)) return;

  activePrintIds.add(orderId);
  renderOrders();
  let claimed = false;

  try {
    claimed = await claimPrint(orderId, force);
    if (!claimed) {
      if (!automatic) {
        setMessage(staffMessage, "This order is already printed or another print job is in progress.", true);
      }
      return;
    }

    const order = await loadOrderForPrint(orderId);
    const receipts = window.elimReceipt.buildCategoryReceipts(order, receiptSettings);
    if (!receipts.length) throw new Error("This order has no category tickets to print.");

    for (const [index, receipt] of receipts.entries()) {
      setMessage(
        staffMessage,
        `${automatic ? "Automatically printing" : "Reprinting"} order #${order.order_number}: ${receipt.category} (${index + 1}/${receipts.length})...`
      );
      await window.elimPrinter.print(receipt.bytes);
    }

    try {
      await finishPrint(orderId, true);
    } catch (trackingError) {
      console.error("Receipt printed but tracking update failed:", trackingError);
      setMessage(
        staffMessage,
        `Order #${order.order_number} printed, but its database tracking update failed. Do not reprint until checked: ${trackingError.message}`,
        true
      );
      return;
    }

    setMessage(staffMessage, `Order #${order.order_number} printed successfully as ${receipts.length} category ticket(s).`);
  } catch (error) {
    console.error("Order print failed:", error);
    if (claimed) {
      try {
        await finishPrint(orderId, false);
      } catch (trackingError) {
        console.error("Could not record failed print attempt:", trackingError);
      }
    }
    setMessage(staffMessage, `Print failed: ${error.message}`, true);
  } finally {
    activePrintIds.delete(orderId);
    await loadOrders({ processPrints: false });
  }
}

function enqueuePrint(orderId, options) {
  if (queuedPrintIds.has(orderId) || activePrintIds.has(orderId)) {
    if (!options.automatic) setMessage(staffMessage, "This order is already queued for printing.");
    return printQueue;
  }

  queuedPrintIds.add(orderId);
  renderOrders();
  printQueue = printQueue
    .then(() => printOrder(orderId, options))
    .catch((error) => {
      console.error("Unexpected print queue error:", error);
      setMessage(staffMessage, `Print queue error: ${error.message}`, true);
    })
    .finally(() => {
      queuedPrintIds.delete(orderId);
      renderOrders();
    });
  return printQueue;
}

function queuePendingAutomaticPrints() {
  if (!printerConnected || !receiptSettingsLoaded) return;
  orders
    .filter((order) => (
      order.print_status === "pending"
      && !activePrintIds.has(order.id)
      && !queuedPrintIds.has(order.id)
    ))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((order) => enqueuePrint(order.id, { automatic: true }));
}

async function updateOrderStatus(orderId, status) {
  if (!STATUSES.includes(status)) return;
  setMessage(staffMessage, "Updating order...");

  const { error } = await window.elimSupabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    console.error("Could not update order status:", error);
    setMessage(staffMessage, `Could not update order: ${error.message}`, true);
    return;
  }

  orders = orders.map((order) => (order.id === orderId ? { ...order, status } : order));
  setMessage(staffMessage, "Order status updated.");
  renderOrders();
}

function subscribeToOrders() {
  if (realtimeChannel) return;
  realtimeChannel = window.elimSupabase
    .channel("elim-cafe-staff-orders")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => loadOrders())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setMessage(staffMessage, "Live updates connected.");
      if (status === "CHANNEL_ERROR") {
        setMessage(staffMessage, "Realtime connection failed. Use Refresh while checking Supabase settings.", true);
      }
    });
}

async function stopRealtime() {
  if (!realtimeChannel) return;
  await window.elimSupabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
}

async function handleSession(session) {
  if (!session?.user) {
    await stopRealtime();
    orders = [];
    receiptSettingsLoaded = false;
    showLogin(pendingLoginError, Boolean(pendingLoginError));
    pendingLoginError = "";
    return;
  }

  if (!(await isAuthorizedStaff(session.user.id))) {
    await stopRealtime();
    pendingLoginError = "This account is not authorized for the staff dashboard.";
    await window.elimSupabase.auth.signOut();
    showLogin(pendingLoginError, true);
    return;
  }

  showDashboard();
  await loadReceiptSettings();
  await loadOrders();
  subscribeToOrders();
}

async function signInStaff(event) {
  event.preventDefault();
  const email = staffEmail.value.trim();
  const password = staffPassword.value;
  if (!email || !password) return;

  staffSignIn.disabled = true;
  setMessage(loginMessage, "Signing in...");
  const { data, error } = await window.elimSupabase.auth.signInWithPassword({ email, password });
  staffSignIn.disabled = false;

  if (error) {
    console.error("Could not sign in staff user:", error);
    setMessage(loginMessage, `Could not sign in: ${error.message}`, true);
    return;
  }
  if (!data.session) setMessage(loginMessage, "Could not sign in: Supabase did not return a session.", true);
}

async function initializeStaffApp() {
  if (!window.elimSupabaseConfigured || !window.elimSupabase) {
    showLogin("Add your Supabase URL and publishable key in js/supabase-config.js.", true);
    loginForm.hidden = true;
    return;
  }

  const { data, error } = await window.elimSupabase.auth.getSession();
  if (error) {
    console.error("Could not restore staff session:", error);
    showLogin(`Could not sign in: ${error.message}`, true);
  } else {
    await handleSession(data.session);
  }

  window.elimSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    window.setTimeout(() => handleSession(session), 0);
  });
}

ordersList.addEventListener("click", (event) => {
  const reprintButton = event.target.closest("[data-reprint-id]");
  if (reprintButton) {
    enqueuePrint(reprintButton.dataset.reprintId, { force: true, automatic: false });
    return;
  }

  const statusButton = event.target.closest("[data-order-id]");
  if (statusButton) updateOrderStatus(statusButton.dataset.orderId, statusButton.dataset.status);
});

receiptSettingsForm.addEventListener("submit", saveReceiptSettings);
receiptSettingsForm.addEventListener("input", () => renderReceiptPreview());
receiptPreviewButton.addEventListener("click", () => {
  renderReceiptPreview();
  setMessage(receiptSettingsMessage, "Preview updated. Save settings to use them for live orders.");
});
receiptTestPrint.addEventListener("click", async () => {
  if (!printerConnected) return;
  receiptTestPrint.disabled = true;
  try {
    const settings = currentReceiptSettings();
    renderReceiptPreview(settings);
    const receipts = window.elimReceipt.buildCategoryReceipts(previewOrder(), settings);
    for (const receipt of receipts) {
      await window.elimPrinter.print(receipt.bytes);
    }
    setMessage(receiptSettingsMessage, `${receipts.length} category preview ticket(s) printed.`);
  } catch (error) {
    console.error("Receipt preview print failed:", error);
    setMessage(receiptSettingsMessage, `Test print failed: ${error.message}`, true);
  } finally {
    receiptTestPrint.disabled = !printerConnected;
  }
});

window.elimPrinter.onStatus((status) => {
  printerConnected = status.state === "connected";
  updatePrinterWarning();
  if (printerConnected) queuePendingAutomaticPrints();
});

loginForm.addEventListener("submit", signInStaff);
refreshOrders.addEventListener("click", () => loadOrders());
staffLogout.addEventListener("click", async () => {
  staffLogout.disabled = true;
  await stopRealtime();
  const { error } = await window.elimSupabase.auth.signOut();
  staffLogout.disabled = false;
  if (error) {
    console.error("Could not sign out:", error);
    setMessage(staffMessage, `Could not sign out: ${error.message}`, true);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20261018-2");
  });
}

fillReceiptSettingsForm(receiptSettings);
initializeStaffApp();
