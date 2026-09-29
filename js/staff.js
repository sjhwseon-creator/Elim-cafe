const ordersList = document.querySelector("#orders-list");
const staffMessage = document.querySelector("#staff-message");
const refreshOrders = document.querySelector("#refresh-orders");

const STATUSES = ["new", "preparing", "completed"];
const PAYMENT_LABELS = {
  paypal: "PayPal",
  sepa: "SEPA bank transfer",
  cash: "Cash"
};
let orders = [];
let realtimeChannel = null;

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStaffMessage(message, isError = false) {
  staffMessage.textContent = message;
  staffMessage.classList.toggle("error", isError);
}

function statusLabel(status) {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
            <strong>${escapeHtml(item.quantity)} x ${escapeHtml(item.item_name)}</strong>
            <span>${formatEuro(item.unit_price)}</span>
          </li>
        `).join("")}
      </ul>

      <div class="order-footer">
        <p class="order-total">${formatEuro(order.total_price)}</p>
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

async function loadOrders() {
  if (!window.elimSupabaseConfigured || !window.elimSupabase) {
    setStaffMessage("Add your Supabase URL and anon key in js/supabase-config.js to load live orders.", true);
    return;
  }

  refreshOrders.disabled = true;
  setStaffMessage("Loading orders...");

  const { data, error } = await window.elimSupabase
    .from("orders")
    .select("id, order_number, customer_name, total_price, payment_method, status, created_at, order_items(item_name, quantity, unit_price)")
    .order("created_at", { ascending: false });

  refreshOrders.disabled = false;

  if (error) {
    setStaffMessage(`Could not load orders: ${error.message}`, true);
    return;
  }

  orders = data || [];
  setStaffMessage(realtimeChannel ? "Live updates connected." : "");
  renderOrders();
}

async function updateOrderStatus(orderId, status) {
  if (!STATUSES.includes(status)) return;

  setStaffMessage("Updating order...");

  const { error } = await window.elimSupabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    setStaffMessage(`Could not update order: ${error.message}`, true);
    return;
  }

  orders = orders.map((order) => (order.id === orderId ? { ...order, status } : order));
  setStaffMessage("Order status updated.");
  renderOrders();
}

function subscribeToOrders() {
  if (!window.elimSupabaseConfigured || !window.elimSupabase) return;

  realtimeChannel = window.elimSupabase
    .channel("elim-cafe-staff-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      loadOrders
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_items" },
      loadOrders
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStaffMessage("Live updates connected.");
      }
      if (status === "CHANNEL_ERROR") {
        setStaffMessage("Realtime connection failed. Use Refresh while checking Supabase settings.", true);
      }
    });
}

ordersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-order-id]");
  if (!button) return;
  updateOrderStatus(button.dataset.orderId, button.dataset.status);
});

refreshOrders.addEventListener("click", loadOrders);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20260925");
  });
}

loadOrders();
subscribeToOrders();
