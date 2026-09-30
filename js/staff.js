const loginPanel = document.querySelector("#staff-login-panel");
const loginForm = document.querySelector("#staff-login-form");
const staffEmail = document.querySelector("#staff-email");
const sendMagicLink = document.querySelector("#send-magic-link");
const loginMessage = document.querySelector("#login-message");
const staffDashboard = document.querySelector("#staff-dashboard");
const staffLogout = document.querySelector("#staff-logout");
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
let pendingLoginError = "";

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

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function statusLabel(status) {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

async function loadOrders() {
  refreshOrders.disabled = true;
  setMessage(staffMessage, "Loading orders...");

  const { data, error } = await window.elimSupabase
    .from("orders")
    .select("id, order_number, customer_name, total_price, payment_method, status, created_at, order_items(item_name, quantity, unit_price)")
    .order("created_at", { ascending: false });

  refreshOrders.disabled = false;

  if (error) {
    console.error("Could not load orders:", error);
    setMessage(staffMessage, `Could not load orders: ${error.message}`, true);
    return;
  }

  orders = data || [];
  setMessage(staffMessage, realtimeChannel ? "Live updates connected." : "");
  renderOrders();
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
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, loadOrders)
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
  await loadOrders();
  subscribeToOrders();
}

async function sendStaffMagicLink(event) {
  event.preventDefault();
  const email = staffEmail.value.trim();
  if (!email) return;

  sendMagicLink.disabled = true;
  setMessage(loginMessage, "Sending sign-in link...");

  const redirectUrl = new URL("staff.html", window.location.href).href;
  console.info("Staff Magic Link redirect URL:", redirectUrl);
  const { error } = await window.elimSupabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
      shouldCreateUser: false
    }
  });

  sendMagicLink.disabled = false;

  if (error) {
    console.error("Could not send staff magic link:", error);
    setMessage(loginMessage, `Could not send sign-in link: ${error.message}`, true);
    return;
  }

  setMessage(loginMessage, "Check the staff inbox and open the sign-in link on this tablet.");
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
    showLogin("Could not restore the staff session. Please sign in again.", true);
  } else {
    await handleSession(data.session);
  }

  window.elimSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    window.setTimeout(() => handleSession(session), 0);
  });
}

ordersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-order-id]");
  if (!button) return;
  updateOrderStatus(button.dataset.orderId, button.dataset.status);
});

loginForm.addEventListener("submit", sendStaffMagicLink);
refreshOrders.addEventListener("click", loadOrders);
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
    navigator.serviceWorker.register("service-worker.js?v=20260930");
  });
}

initializeStaffApp();
