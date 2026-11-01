const cart = new Map();

const menuGroups = document.querySelector("#menu-groups");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const customerName = document.querySelector("#customer-name");
const checkoutCurrentBalance = document.querySelector("#checkout-current-balance");
const checkoutOrderTotal = document.querySelector("#checkout-order-total");
const checkoutBalanceAfter = document.querySelector("#checkout-balance-after");
const reviewOrder = document.querySelector("#review-order");
const placeOrder = document.querySelector("#place-order");
const clearCart = document.querySelector("#clear-cart");
const orderSummary = document.querySelector("#order-summary");
const formMessage = document.querySelector("#form-message");
const confirmationScreen = document.querySelector("#confirmation-screen");
const confirmationNumber = document.querySelector("#confirmation-number");
const confirmationTotal = document.querySelector("#confirmation-total");
const confirmationBalance = document.querySelector("#confirmation-balance");
const newOrder = document.querySelector("#new-order");
const customerAppShell = document.querySelector("#customer-app-shell");
const customerAccountSummary = document.querySelector("#customer-account-summary");
const customerAccountGreeting = document.querySelector("#customer-account-greeting");
const customerAccountBalance = document.querySelector("#customer-account-balance");
const customerSignOut = document.querySelector("#customer-sign-out");
const notificationToggle = document.querySelector("#notification-toggle");
const notificationMessage = document.querySelector("#notification-message");
const confirmationNotificationEnable = document.querySelector("#confirmation-notification-enable");
const orderReadyOverlay = document.querySelector("#order-ready-overlay");
const orderReadyNumber = document.querySelector("#order-ready-number");
const orderReadyClose = document.querySelector("#order-ready-close");
const customerAuthOverlay = document.querySelector("#customer-auth-overlay");
const customerAuthLoading = document.querySelector("#customer-auth-loading");
const customerAuthContent = document.querySelector("#customer-auth-content");
const customerSignInForm = document.querySelector("#customer-sign-in-form");
const customerSignUpForm = document.querySelector("#customer-sign-up-form");
const customerSignInEmail = document.querySelector("#customer-sign-in-email");
const customerSignInPassword = document.querySelector("#customer-sign-in-password");
const customerSignUpName = document.querySelector("#customer-sign-up-name");
const customerSignUpEmail = document.querySelector("#customer-sign-up-email");
const customerSignUpPassword = document.querySelector("#customer-sign-up-password");
const customerSignUpConfirmPassword = document.querySelector("#customer-sign-up-confirm-password");
const customerAuthMessage = document.querySelector("#customer-auth-message");

let currentMessage = { key: "", variables: {}, isError: false };
let lastConfirmation = null;
let currentCustomerProfile = null;
let currentCustomerBalance = 0;
let authMessage = { key: "", isError: false };
let notificationMessageState = { key: "", isError: false };
let currentPushSubscription = null;
let orderReadyAudioContext = null;
let lastReadyOrderNumber = null;
const customerOrderChannels = new Map();
const notifiedOrderIds = new Set();

const CATEGORY_PRESENTATION = {
  Coffee: {
    className: "coffee",
    icon: "☕",
    titleKey: "category.coffee",
    descriptionKey: "category.coffeeDescription"
  },
  Latte: {
    className: "latte",
    icon: "☕",
    titleKey: "category.latte",
    descriptionKey: "category.latteDescription"
  },
  Ade: {
    className: "ade",
    icon: "🍹",
    titleKey: "category.ade",
    descriptionKey: "category.adeDescription"
  }
};

function t(key, variables = {}) {
  return window.ELIM_I18N.t(key, variables);
}

function formatEuro(value) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function setBalanceTone(element, value) {
  element.classList.toggle("negative-balance", Number(value) < 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setAuthMessage(key = "", isError = false) {
  authMessage = { key, isError };
  customerAuthMessage.textContent = key ? t(key) : "";
  customerAuthMessage.classList.toggle("error", isError);
}

function setNotificationMessage(key = "", isError = false) {
  notificationMessageState = { key, isError };
  notificationMessage.textContent = key ? t(key) : "";
  notificationMessage.classList.toggle("error", isError);
}

function supportsPushNotifications() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function hasConfiguredVapidKey() {
  const key = window.ELIM_NOTIFICATION_CONFIG?.vapidPublicKey || "";
  return key && !key.startsWith("REPLACE_WITH_");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function getServiceWorkerRegistration() {
  if (!supportsPushNotifications()) return null;
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (existingRegistration) return existingRegistration;
  return navigator.serviceWorker.register("service-worker.js?v=20261103");
}

async function savePushSubscription(subscription) {
  if (!currentCustomerProfile || !subscription) return false;
  const serialized = subscription.toJSON();
  const { error } = await window.elimSupabase.from("push_subscriptions").upsert({
    user_id: currentCustomerProfile.user_id,
    endpoint: subscription.endpoint,
    p256dh: serialized.keys?.p256dh,
    auth: serialized.keys?.auth,
    language: window.ELIM_I18N.getLanguage(),
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });

  if (error) {
    console.error("Could not save push subscription:", error);
    return false;
  }
  return true;
}

function renderNotificationControls() {
  const signedIn = Boolean(currentCustomerProfile);
  const enabled = Boolean(currentPushSubscription);
  notificationToggle.hidden = !signedIn || !supportsPushNotifications();
  notificationToggle.textContent = t(enabled ? "notification.disable" : "notification.enable");
  confirmationNotificationEnable.hidden = !signedIn || enabled || !supportsPushNotifications();
}

async function refreshPushSubscription() {
  currentPushSubscription = null;
  if (!currentCustomerProfile || !supportsPushNotifications()) {
    renderNotificationControls();
    return;
  }

  try {
    const registration = await getServiceWorkerRegistration();
    currentPushSubscription = await registration?.pushManager.getSubscription() || null;
    if (currentPushSubscription) await savePushSubscription(currentPushSubscription);
  } catch (error) {
    console.error("Could not read push subscription:", error);
  }
  renderNotificationControls();
}

async function enableOrderNotifications() {
  if (!currentCustomerProfile) return;
  if (!supportsPushNotifications() || !hasConfiguredVapidKey()) {
    setNotificationMessage("notification.unsupported", true);
    return;
  }

  notificationToggle.disabled = true;
  confirmationNotificationEnable.disabled = true;
  setNotificationMessage("notification.enabling");

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotificationMessage("notification.denied", true);
      return;
    }

    const registration = await getServiceWorkerRegistration();
    currentPushSubscription = await registration.pushManager.getSubscription();
    if (!currentPushSubscription) {
      currentPushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.ELIM_NOTIFICATION_CONFIG.vapidPublicKey)
      });
    }

    if (!await savePushSubscription(currentPushSubscription)) {
      throw new Error("Push subscription could not be saved");
    }
    setNotificationMessage("notification.enabled");
  } catch (error) {
    console.error("Could not enable order notifications:", error);
    currentPushSubscription = null;
    setNotificationMessage("notification.error", true);
  } finally {
    notificationToggle.disabled = false;
    confirmationNotificationEnable.disabled = false;
    renderNotificationControls();
  }
}

async function disableOrderNotifications({ silent = false } = {}) {
  if (!currentPushSubscription) return;
  const endpoint = currentPushSubscription.endpoint;

  try {
    if (currentCustomerProfile) {
      const { error } = await window.elimSupabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);
      if (error) throw error;
    }
    await currentPushSubscription.unsubscribe();
    currentPushSubscription = null;
    if (!silent) setNotificationMessage("notification.disabled");
  } catch (error) {
    console.error("Could not disable order notifications:", error);
    if (!silent) setNotificationMessage("notification.error", true);
  }
  renderNotificationControls();
}

async function toggleOrderNotifications() {
  if (currentPushSubscription) await disableOrderNotifications();
  else await enableOrderNotifications();
}

function playOrderReadySound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    orderReadyAudioContext ||= new AudioContextClass();
    const oscillator = orderReadyAudioContext.createOscillator();
    const gain = orderReadyAudioContext.createGain();
    oscillator.frequency.setValueAtTime(880, orderReadyAudioContext.currentTime);
    oscillator.frequency.setValueAtTime(1046, orderReadyAudioContext.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, orderReadyAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, orderReadyAudioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, orderReadyAudioContext.currentTime + 0.42);
    oscillator.connect(gain).connect(orderReadyAudioContext.destination);
    oscillator.start();
    oscillator.stop(orderReadyAudioContext.currentTime + 0.44);
  } catch (error) {
    console.warn("Order-ready sound could not play:", error);
  }
}

function showOrderReady(order) {
  const notificationKey = order.id || `number-${order.order_number}`;
  if (notifiedOrderIds.has(notificationKey)) return;
  notifiedOrderIds.add(notificationKey);
  lastReadyOrderNumber = order.order_number;
  orderReadyNumber.textContent = t("ready.order", { number: order.order_number });
  orderReadyOverlay.hidden = false;
  playOrderReadySound();
  navigator.vibrate?.([250, 100, 250]);
}

async function stopWatchingOrder(orderId) {
  const channel = customerOrderChannels.get(orderId);
  if (!channel) return;
  customerOrderChannels.delete(orderId);
  await window.elimSupabase.removeChannel(channel);
}

async function stopWatchingCustomerOrders() {
  const channels = [...customerOrderChannels.values()];
  customerOrderChannels.clear();
  await Promise.all(channels.map((channel) => window.elimSupabase.removeChannel(channel)));
}

function watchCustomerOrder(order) {
  if (!currentCustomerProfile || !order?.id || customerOrderChannels.has(order.id)) return;
  const channel = window.elimSupabase
    .channel(`elim-customer-order-${order.id}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "orders",
      filter: `id=eq.${order.id}`
    }, (payload) => {
      if (payload.new?.status !== "completed") return;
      showOrderReady({ id: order.id, order_number: payload.new.order_number || order.order_number });
      stopWatchingOrder(order.id);
    })
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const { data } = await window.elimSupabase
        .from("orders")
        .select("id, order_number, status")
        .eq("id", order.id)
        .maybeSingle();
      if (data?.status === "completed") {
        showOrderReady(data);
        stopWatchingOrder(order.id);
      }
    });
  customerOrderChannels.set(order.id, channel);
}

async function watchOpenCustomerOrders() {
  await stopWatchingCustomerOrders();
  if (!currentCustomerProfile) return;
  const { data, error } = await window.elimSupabase
    .from("orders")
    .select("id, order_number, status")
    .in("status", ["new", "preparing"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("Could not load customer orders for notifications:", error);
    return;
  }
  (data || []).forEach(watchCustomerOrder);
}

function renderCustomerAccount() {
  customerAccountSummary.hidden = !currentCustomerProfile;
  if (!currentCustomerProfile) return;
  customerAccountGreeting.textContent = t("auth.hello", { name: currentCustomerProfile.display_name });
  customerAccountBalance.textContent = formatEuro(currentCustomerBalance);
  setBalanceTone(customerAccountBalance, currentCustomerBalance);
  renderNotificationControls();
  renderWalletCheckout();
}

function showAuthGate({ loading = false } = {}) {
  customerAppShell.hidden = true;
  customerAuthOverlay.hidden = false;
  customerAuthLoading.hidden = !loading;
  customerAuthContent.hidden = loading;
  if (!loading) window.setTimeout(() => customerSignInEmail.focus(), 0);
}

function showCustomerApp() {
  customerAuthOverlay.hidden = true;
  customerAuthLoading.hidden = true;
  customerAuthContent.hidden = true;
  customerAppShell.hidden = false;
  setAuthMessage();
}

async function loadCustomerAccount(session) {
  if (!session?.user) {
    await stopWatchingCustomerOrders();
    currentCustomerProfile = null;
    currentCustomerBalance = 0;
    renderCustomerAccount();
    showAuthGate();
    return false;
  }

  const [profileResult, walletResult] = await Promise.all([
    window.elimSupabase
      .from("customer_profiles")
      .select("user_id, display_name, email, active")
      .eq("user_id", session.user.id)
      .maybeSingle(),
    window.elimSupabase
      .from("wallet_accounts")
      .select("balance")
      .eq("user_id", session.user.id)
      .maybeSingle()
  ]);

  if (profileResult.error || walletResult.error) {
    console.error("Could not load customer account:", profileResult.error || walletResult.error);
    currentCustomerProfile = null;
    currentCustomerBalance = 0;
    await stopWatchingCustomerOrders();
    renderCustomerAccount();
    showAuthGate();
    setAuthMessage("auth.profileFailed", true);
    return false;
  }

  if (!profileResult.data?.active) {
    currentCustomerProfile = null;
    currentCustomerBalance = 0;
    await stopWatchingCustomerOrders();
    renderCustomerAccount();
    showAuthGate();
    setAuthMessage("auth.inactive", true);
    return false;
  }

  currentCustomerProfile = profileResult.data;
  currentCustomerBalance = Number(walletResult.data?.balance || 0);
  if (!customerName.value.trim()) customerName.value = currentCustomerProfile.display_name;
  renderCustomerAccount();
  showCustomerApp();
  await Promise.all([refreshPushSubscription(), watchOpenCustomerOrders()]);
  return true;
}

async function signInCustomer(event) {
  event.preventDefault();
  const submitButton = customerSignInForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setAuthMessage("auth.signingIn");

  const { data, error } = await window.elimSupabase.auth.signInWithPassword({
    email: customerSignInEmail.value.trim(),
    password: customerSignInPassword.value
  });
  submitButton.disabled = false;

  if (error || !data.session) {
    console.error("Customer sign-in failed:", error || data);
    setAuthMessage("auth.signInFailed", true);
    return;
  }

  customerSignInPassword.value = "";
  await loadCustomerAccount(data.session);
}

async function signUpCustomer(event) {
  event.preventDefault();
  if (customerSignUpPassword.value !== customerSignUpConfirmPassword.value) {
    setAuthMessage("auth.passwordMismatch", true);
    customerSignUpConfirmPassword.focus();
    return;
  }
  const submitButton = customerSignUpForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setAuthMessage("auth.creating");

  const name = customerSignUpName.value.trim();
  const { data, error } = await window.elimSupabase.auth.signUp({
    email: customerSignUpEmail.value.trim(),
    password: customerSignUpPassword.value,
    options: {
      emailRedirectTo: new URL("index.html", window.location.href).href,
      data: {
        display_name: name,
        account_type: "customer"
      }
    }
  });
  submitButton.disabled = false;

  if (error) {
    console.error("Customer sign-up failed:", error);
    setAuthMessage("auth.signUpFailed", true);
    return;
  }

  customerSignUpPassword.value = "";
  customerSignUpConfirmPassword.value = "";
  if (data.session) {
    await loadCustomerAccount(data.session);
  } else {
    setAuthMessage("auth.checkEmail");
  }
}

async function signOutCustomer() {
  customerSignOut.disabled = true;
  await disableOrderNotifications({ silent: true });
  const { error } = await window.elimSupabase.auth.signOut();
  customerSignOut.disabled = false;
  if (error) {
    console.error("Customer sign-out failed:", error);
    return;
  }
  currentCustomerProfile = null;
  currentCustomerBalance = 0;
  await stopWatchingCustomerOrders();
  cart.clear();
  lastConfirmation = null;
  confirmationScreen.hidden = true;
  orderReadyOverlay.hidden = true;
  customerName.value = "";
  hideOrderActions();
  renderMenu();
  renderCart();
  renderCustomerAccount();
  showAuthGate();
}

async function initializeCustomerAuth() {
  showAuthGate({ loading: true });
  if (!window.elimSupabaseConfigured || !window.elimSupabase) {
    showAuthGate();
    setAuthMessage("error.serviceUnavailable", true);
    return;
  }

  if (window.elimAuthCallbackDetected) {
    const { error } = await window.elimCompleteAuthCallback();
    if (error) {
      console.error("Could not complete customer email confirmation:", error);
      showAuthGate();
      setAuthMessage("auth.callbackFailed", true);
    }
  }

  const { data, error } = await window.elimSupabase.auth.getSession();
  if (error) {
    console.error("Could not restore customer session:", error);
    showAuthGate();
    setAuthMessage("auth.sessionFailed", true);
  } else {
    await loadCustomerAccount(data.session);
  }

  window.elimSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    window.setTimeout(() => loadCustomerAccount(session), 0);
  });
}

function getMenuItem(id) {
  return window.ELIM_MENU.flatMap((group) => group.items).find((item) => item.id === id);
}

function getCartKey(id, variant = null) {
  return `${id}::${variant || "standard"}`;
}

function parseCartKey(key) {
  const separatorIndex = key.lastIndexOf("::");
  const id = key.slice(0, separatorIndex);
  const storedVariant = key.slice(separatorIndex + 2);
  return { id, variant: storedVariant === "standard" ? null : storedVariant };
}

function getVariantLabel(variant) {
  return variant ? t(`variant.${variant}`) : "";
}

function getVariantPrice(item, variant) {
  return item.price + (variant === "ice" ? 0.5 : 0);
}

function getDisplayName(item) {
  return item.variant ? `${item.name} (${getVariantLabel(item.variant)})` : item.name;
}

function getCartRows() {
  return Array.from(cart.entries())
    .map(([key, quantity]) => {
      const { id, variant } = parseCartKey(key);
      const menuItem = getMenuItem(id);
      if (!menuItem) return null;

      return {
        ...menuItem,
        variant,
        price: getVariantPrice(menuItem, variant),
        quantity
      };
    })
    .filter((item) => item?.quantity > 0);
}

function getTotal(rows = getCartRows()) {
  return rows.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderWalletCheckout(rows = getCartRows()) {
  const orderTotal = getTotal(rows);
  const balanceAfter = currentCustomerBalance - orderTotal;
  checkoutCurrentBalance.textContent = formatEuro(currentCustomerBalance);
  checkoutOrderTotal.textContent = formatEuro(orderTotal);
  checkoutBalanceAfter.textContent = formatEuro(balanceAfter);
  setBalanceTone(checkoutCurrentBalance, currentCustomerBalance);
  setBalanceTone(checkoutBalanceAfter, balanceAfter);
}

function setMessage(key = "", variables = {}, isError = false) {
  currentMessage = { key, variables, isError };
  formMessage.textContent = key ? t(key, variables) : "";
  formMessage.classList.toggle("error", isError);
}

function refreshMessage() {
  const { key, variables, isError } = currentMessage;
  formMessage.textContent = key ? t(key, variables) : "";
  formMessage.classList.toggle("error", isError);
}

function hideOrderActions() {
  orderSummary.hidden = true;
  placeOrder.hidden = true;
  placeOrder.disabled = false;
}

function updateQuantity(id, variant, change) {
  const key = getCartKey(id, variant);
  const nextQuantity = Math.max(0, (cart.get(key) || 0) + change);

  if (nextQuantity === 0) {
    cart.delete(key);
  } else {
    cart.set(key, nextQuantity);
  }

  hideOrderActions();
  renderMenu();
  renderCart();
}

function renderQuantityControls(item, variant = null) {
  const quantity = cart.get(getCartKey(item.id, variant)) || 0;
  const variantLabel = getVariantLabel(variant);
  const itemLabel = variantLabel ? `${item.name} ${variantLabel}` : item.name;

  return `
    <div class="quantity-controls" aria-label="${escapeHtml(t("aria.quantity", { item: itemLabel }))}">
      <button class="qty-button" type="button" data-action="decrease" data-id="${escapeHtml(item.id)}" data-variant="${variant || ""}" aria-label="${escapeHtml(t("aria.removeOne", { item: itemLabel }))}" ${quantity === 0 ? "disabled" : ""}>-</button>
      <span class="qty-value">${quantity}</span>
      <button class="qty-button" type="button" data-action="increase" data-id="${escapeHtml(item.id)}" data-variant="${variant || ""}" aria-label="${escapeHtml(t("aria.addOne", { item: itemLabel }))}">+</button>
    </div>
  `;
}

function renderMenu() {
  menuGroups.innerHTML = window.ELIM_MENU.map((group) => {
    const presentation = CATEGORY_PRESENTATION[group.category] || {
      className: "default",
      icon: "☕",
      titleKey: "",
      descriptionKey: "category.defaultDescription"
    };
    const categoryTitle = presentation.titleKey ? t(presentation.titleKey) : group.category;

    return `
    <section class="menu-group category-${presentation.className}">
      <div class="category-header">
        <span class="category-art" aria-hidden="true">${presentation.icon}</span>
        <div>
          <h3 class="category-title">${escapeHtml(categoryTitle)}</h3>
          <p class="category-description">${escapeHtml(t(presentation.descriptionKey))} <span aria-hidden="true">♥</span></p>
        </div>
      </div>
      <div class="menu-list">
        ${group.items.map((item) => {
          if (item.variants?.length) {
            return `
              <article class="menu-item has-variants">
                <p class="item-name">${escapeHtml(item.name)}</p>
                <div class="variant-options">
                  ${item.variants.map((variant) => `
                    <div class="variant-option">
                      <div class="variant-heading">
                        <span class="variant-name">${getVariantLabel(variant)}</span>
                        <span class="variant-price">${formatEuro(getVariantPrice(item, variant))}</span>
                      </div>
                      ${renderQuantityControls(item, variant)}
                    </div>
                  `).join("")}
                </div>
              </article>
            `;
          }

          return `
            <article class="menu-item">
              <div>
                <p class="item-name">${escapeHtml(item.name)}</p>
                <p class="item-price">${formatEuro(item.price)}</p>
              </div>
              ${renderQuantityControls(item)}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
  }).join("");
}

function renderCart() {
  const rows = getCartRows();
  const itemCount = rows.reduce((sum, item) => sum + item.quantity, 0);

  cartCount.textContent = t(itemCount === 1 ? "cart.itemCountOne" : "cart.itemCountMany", { count: itemCount });
  cartTotal.textContent = formatEuro(getTotal(rows));
  renderWalletCheckout(rows);
  reviewOrder.disabled = itemCount === 0;
  clearCart.disabled = itemCount === 0;

  if (rows.length === 0) {
    cartItems.className = "cart-items empty-state";
    cartItems.textContent = t("cart.empty");
    setMessage();
    return;
  }

  cartItems.className = "cart-items";
  cartItems.innerHTML = rows.map((item) => {
    const displayName = getDisplayName(item);
    return `
    <article class="cart-item" data-cart-key="${escapeHtml(getCartKey(item.id, item.variant))}">
      <div>
        <p class="item-name">${escapeHtml(displayName)}</p>
        <p class="item-meta">${item.quantity} x ${formatEuro(item.price)} = ${formatEuro(item.price * item.quantity)}</p>
      </div>
      <div class="cart-actions">
        <div class="quantity-controls" aria-label="${escapeHtml(t("aria.cartQuantity", { item: displayName }))}">
          <button class="qty-button" type="button" data-action="decrease" data-id="${escapeHtml(item.id)}" data-variant="${item.variant || ""}" aria-label="${escapeHtml(t("aria.removeOne", { item: displayName }))}">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-button" type="button" data-action="increase" data-id="${escapeHtml(item.id)}" data-variant="${item.variant || ""}" aria-label="${escapeHtml(t("aria.addOne", { item: displayName }))}">+</button>
        </div>
        <button class="remove-button" type="button" data-action="remove" data-id="${escapeHtml(item.id)}" data-variant="${item.variant || ""}">${escapeHtml(t("cart.remove"))}</button>
      </div>
    </article>
  `;
  }).join("");
}

function renderSummary() {
  const rows = getCartRows();
  const name = customerName.value.trim();

  if (!rows.length) {
    setMessage("validation.addItem", {}, true);
    return;
  }

  if (!name) {
    setMessage("validation.enterName", {}, true);
    customerName.focus();
    return;
  }

  setMessage();
  const total = getTotal(rows);
  const balanceAfter = currentCustomerBalance - total;
  orderSummary.innerHTML = `
    <strong>${escapeHtml(t("order.confirmFor", { name }))}</strong>
    <ul>
      ${rows.map((item) => `<li>${item.quantity} x ${escapeHtml(getDisplayName(item))} - ${formatEuro(item.price * item.quantity)}</li>`).join("")}
    </ul>
    <p><strong>${escapeHtml(t("order.total", { total: formatEuro(total) }))}</strong></p>
    <p>${escapeHtml(t("wallet.currentBalance"))}: <strong class="${currentCustomerBalance < 0 ? "negative-balance" : ""}">${formatEuro(currentCustomerBalance)}</strong></p>
    <p>${escapeHtml(t("wallet.balanceAfter"))}: <strong class="${balanceAfter < 0 ? "negative-balance" : ""}">${formatEuro(balanceAfter)}</strong></p>
  `;
  orderSummary.hidden = false;
  placeOrder.hidden = false;
}

function renderConfirmation() {
  if (!lastConfirmation) return;

  confirmationNumber.textContent = t("order.number", {
    number: lastConfirmation.orderNumber
  });
  confirmationTotal.textContent = t("order.total", {
    total: formatEuro(lastConfirmation.totalPrice)
  });
  const hasWalletBalance = Number.isFinite(lastConfirmation.newBalance);
  confirmationBalance.hidden = !hasWalletBalance;
  if (hasWalletBalance) {
    confirmationBalance.textContent = t("confirmation.balance", {
      balance: formatEuro(lastConfirmation.newBalance)
    });
    setBalanceTone(confirmationBalance, lastConfirmation.newBalance);
  }
  renderNotificationControls();
}

async function submitOrder() {
  if (placeOrder.disabled) return;

  const rows = getCartRows();
  const name = customerName.value.trim();

  if (!rows.length) {
    setMessage("validation.addItem", {}, true);
    return;
  }

  if (!name) {
    setMessage("validation.enterName", {}, true);
    customerName.focus();
    return;
  }

  if (!currentCustomerProfile) {
    showAuthGate();
    return;
  }

  if (!window.elimSupabaseConfigured || !window.elimSupabase) {
    setMessage("error.serviceUnavailable", {}, true);
    return;
  }

  placeOrder.disabled = true;
  setMessage("order.sending");

  const orderItems = rows.map((item) => ({
    item_id: item.id,
    variant: item.variant,
    quantity: item.quantity
  }));
  const { data: order, error } = await window.elimSupabase.rpc("create_wallet_order", {
    p_customer_name: name,
    p_items: orderItems
  });

  if (error || !order?.order_number) {
    console.error("Supabase RPC error while creating order:", error || order);
    placeOrder.disabled = false;
    setMessage("error.orderFailed", {}, true);
    return;
  }

  lastConfirmation = {
    id: order.id,
    orderNumber: order.order_number,
    totalPrice: Number(order.total_price),
    newBalance: Number(order.balance)
  };
  currentCustomerBalance = Number(order.balance);
  renderCustomerAccount();
  if (currentCustomerProfile && order.id) {
    watchCustomerOrder({ id: order.id, order_number: order.order_number });
  }
  renderConfirmation();
  confirmationScreen.hidden = false;

  cart.clear();
  customerName.value = currentCustomerProfile?.display_name || "";
  hideOrderActions();
  renderMenu();
  renderCart();
}

function resetCart() {
  cart.clear();
  hideOrderActions();
  renderMenu();
  renderCart();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, id } = button.dataset;
  const variant = button.dataset.variant || null;

  if (action === "increase") updateQuantity(id, variant, 1);
  if (action === "decrease") updateQuantity(id, variant, -1);
  if (action === "remove") {
    cart.delete(getCartKey(id, variant));
    hideOrderActions();
    renderMenu();
    renderCart();
  }
});

document.addEventListener("pointerdown", () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      orderReadyAudioContext ||= new AudioContextClass();
      orderReadyAudioContext.resume?.();
    }
  } catch (error) {
    console.warn("Could not prepare order-ready sound:", error);
  }
}, { once: true });

customerName.addEventListener("input", () => {
  hideOrderActions();
  setMessage("");
});

reviewOrder.addEventListener("click", renderSummary);
placeOrder.addEventListener("click", submitOrder);
clearCart.addEventListener("click", resetCart);
customerSignInForm.addEventListener("submit", signInCustomer);
customerSignUpForm.addEventListener("submit", signUpCustomer);
customerSignOut.addEventListener("click", signOutCustomer);
notificationToggle.addEventListener("click", toggleOrderNotifications);
confirmationNotificationEnable.addEventListener("click", enableOrderNotifications);
orderReadyClose.addEventListener("click", () => {
  orderReadyOverlay.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !orderReadyOverlay.hidden) orderReadyOverlay.hidden = true;
});
newOrder.addEventListener("click", () => {
  confirmationScreen.hidden = true;
});

document.addEventListener("elim:languagechange", () => {
  const preservedMessage = currentMessage;

  renderMenu();
  renderCart();
  if (!orderSummary.hidden) renderSummary();
  renderConfirmation();
  renderCustomerAccount();
  customerAuthMessage.textContent = authMessage.key ? t(authMessage.key) : "";
  notificationMessage.textContent = notificationMessageState.key ? t(notificationMessageState.key) : "";
  renderNotificationControls();
  if (!orderReadyOverlay.hidden && lastReadyOrderNumber) {
    orderReadyNumber.textContent = t("ready.order", { number: lastReadyOrderNumber });
  }
  if (currentPushSubscription) savePushSubscription(currentPushSubscription);

  currentMessage = preservedMessage;
  refreshMessage();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "ORDER_READY") return;
    const payload = event.data.payload || {};
    showOrderReady({ id: payload.orderId, order_number: payload.orderNumber });
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20261103");
  });
}

renderMenu();
renderCart();
renderCustomerAccount();
initializeCustomerAuth();
