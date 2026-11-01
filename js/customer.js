const cart = new Map();

const menuGroups = document.querySelector("#menu-groups");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const customerName = document.querySelector("#customer-name");
const paymentMethodInputs = document.querySelectorAll('input[name="payment-method"]');
const paymentInstructions = document.querySelector("#payment-instructions");
const walletPaymentOption = document.querySelector("#wallet-payment-option");
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
const customerAccountOpen = document.querySelector("#customer-account-open");
const customerAccountSummary = document.querySelector("#customer-account-summary");
const customerAccountGreeting = document.querySelector("#customer-account-greeting");
const customerAccountBalance = document.querySelector("#customer-account-balance");
const customerSignOut = document.querySelector("#customer-sign-out");
const customerAuthOverlay = document.querySelector("#customer-auth-overlay");
const customerAuthClose = document.querySelector("#customer-auth-close");
const customerAuthModeButtons = document.querySelectorAll("[data-auth-mode]");
const customerSignInForm = document.querySelector("#customer-sign-in-form");
const customerSignUpForm = document.querySelector("#customer-sign-up-form");
const customerSignInEmail = document.querySelector("#customer-sign-in-email");
const customerSignInPassword = document.querySelector("#customer-sign-in-password");
const customerSignUpName = document.querySelector("#customer-sign-up-name");
const customerSignUpEmail = document.querySelector("#customer-sign-up-email");
const customerSignUpPassword = document.querySelector("#customer-sign-up-password");
const customerAuthMessage = document.querySelector("#customer-auth-message");

let currentMessage = { key: "", variables: {}, isError: false };
let lastConfirmation = null;
let currentCustomerProfile = null;
let currentCustomerBalance = 0;
let authMessage = { key: "", isError: false };

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

function getPaymentLabel(method) {
  return t(`payment.${method}`);
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

function renderCustomerAccount() {
  const signedIn = Boolean(currentCustomerProfile);
  customerAccountOpen.hidden = signedIn;
  customerAccountSummary.hidden = !signedIn;
  walletPaymentOption.hidden = !signedIn;

  if (!signedIn) {
    const walletInput = walletPaymentOption.querySelector("input");
    if (walletInput.checked) {
      walletInput.checked = false;
      hideOrderActions();
      renderPaymentInstructions();
    }
    return;
  }

  customerAccountGreeting.textContent = t("auth.hello", { name: currentCustomerProfile.display_name });
  customerAccountBalance.textContent = formatEuro(currentCustomerBalance);
  setBalanceTone(customerAccountBalance, currentCustomerBalance);
}

function setAuthMode(mode) {
  const showSignUp = mode === "signup";
  customerSignInForm.hidden = showSignUp;
  customerSignUpForm.hidden = !showSignUp;
  customerAuthModeButtons.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.authMode === mode));
  });
  setAuthMessage();
}

function openCustomerAuth() {
  setAuthMode("signin");
  customerAuthOverlay.hidden = false;
  customerSignInEmail.focus();
}

function closeCustomerAuth() {
  customerAuthOverlay.hidden = true;
  setAuthMessage();
}

async function loadCustomerAccount(session) {
  if (!session?.user) {
    currentCustomerProfile = null;
    currentCustomerBalance = 0;
    renderCustomerAccount();
    return;
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
    renderCustomerAccount();
    setAuthMessage("auth.profileFailed", true);
    return;
  }

  if (!profileResult.data?.active) {
    currentCustomerProfile = null;
    currentCustomerBalance = 0;
    renderCustomerAccount();
    return;
  }

  currentCustomerProfile = profileResult.data;
  currentCustomerBalance = Number(walletResult.data?.balance || 0);
  if (!customerName.value.trim()) customerName.value = currentCustomerProfile.display_name;
  renderCustomerAccount();
  closeCustomerAuth();
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
  if (data.session) {
    await loadCustomerAccount(data.session);
  } else {
    setAuthMessage("auth.checkEmail");
  }
}

async function signOutCustomer() {
  customerSignOut.disabled = true;
  const { error } = await window.elimSupabase.auth.signOut();
  customerSignOut.disabled = false;
  if (error) {
    console.error("Customer sign-out failed:", error);
    return;
  }
  currentCustomerProfile = null;
  currentCustomerBalance = 0;
  renderCustomerAccount();
}

async function initializeCustomerAuth() {
  if (!window.elimSupabaseConfigured || !window.elimSupabase) return;

  if (window.elimAuthCallbackDetected) {
    const { error } = await window.elimCompleteAuthCallback();
    if (error) {
      console.error("Could not complete customer email confirmation:", error);
      openCustomerAuth();
      setAuthMessage("auth.callbackFailed", true);
    }
  }

  const { data, error } = await window.elimSupabase.auth.getSession();
  if (error) {
    console.error("Could not restore customer session:", error);
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

function getSelectedPaymentMethod() {
  return document.querySelector('input[name="payment-method"]:checked')?.value || "";
}

function hasPublicPaymentValue(value) {
  return typeof value === "string" && value.trim() !== "";
}

function renderPaymentInstructions() {
  const method = getSelectedPaymentMethod();
  const config = window.ELIM_PAYMENT_CONFIG;

  if (!method) {
    paymentInstructions.hidden = true;
    paymentInstructions.innerHTML = "";
    return;
  }

  if (method === "paypal") {
    const directPayment = hasPublicPaymentValue(config.paypalAccount)
      ? `
        <p>${escapeHtml(t("payment.paypalAlternative"))}</p>
        <dl class="payment-details">
          <div><dt>${escapeHtml(t("payment.paypalAccount"))}</dt><dd>${escapeHtml(config.paypalAccount)}</dd></div>
        </dl>
      `
      : "";

    paymentInstructions.innerHTML = `
      <p>${escapeHtml(t("payment.paypalScan"))}</p>
      ${directPayment}
    `;
  }

  if (method === "sepa") {
    const hasBankDetails = hasPublicPaymentValue(config.sepaAccountHolder)
      && hasPublicPaymentValue(config.sepaIban);
    const directPayment = hasBankDetails
      ? `
        <p>${escapeHtml(t("payment.sepaAlternative"))}</p>
        <dl class="payment-details">
          <div><dt>${escapeHtml(t("payment.bankName"))}</dt><dd>${escapeHtml(config.bankName)}</dd></div>
          <div>
            <dt>${escapeHtml(t("payment.accountHolder"))}</dt>
            <dd><span>${escapeHtml(config.sepaAccountHolder)}</span><button class="copy-button" type="button" data-copy="account-holder">${escapeHtml(t("payment.copy"))}</button></dd>
          </div>
          <div>
            <dt>${escapeHtml(t("payment.iban"))}</dt>
            <dd><span>${escapeHtml(config.sepaIban)}</span><button class="copy-button" type="button" data-copy="iban">${escapeHtml(t("payment.copy"))}</button></dd>
          </div>
        </dl>
      `
      : "";

    paymentInstructions.innerHTML = `
      <p>${escapeHtml(t("payment.sepaScan"))}</p>
      ${directPayment}
      <dl class="payment-details">
        <div><dt>${escapeHtml(t("payment.totalAmount"))}</dt><dd>${formatEuro(getTotal())}</dd></div>
      </dl>
    `;
  }

  if (method === "cash") {
    paymentInstructions.innerHTML = `<p>${escapeHtml(t("payment.cashInstruction"))}</p>`;
  }

  if (method === "wallet") {
    const orderTotal = getTotal();
    const balanceAfter = currentCustomerBalance - orderTotal;
    paymentInstructions.innerHTML = `
      <p>${escapeHtml(t("payment.walletInstruction"))}</p>
      <dl class="payment-details wallet-balance-preview">
        <div><dt>${escapeHtml(t("payment.currentBalance"))}</dt><dd class="${currentCustomerBalance < 0 ? "negative-balance" : ""}">${formatEuro(currentCustomerBalance)}</dd></div>
        <div><dt>${escapeHtml(t("payment.orderTotal"))}</dt><dd>${formatEuro(orderTotal)}</dd></div>
        <div><dt>${escapeHtml(t("payment.balanceAfter"))}</dt><dd class="${balanceAfter < 0 ? "negative-balance" : ""}">${formatEuro(balanceAfter)}</dd></div>
      </dl>
    `;
  }

  paymentInstructions.hidden = false;
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
  renderPaymentInstructions();
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
  const paymentMethod = getSelectedPaymentMethod();

  if (!rows.length) {
    setMessage("validation.addItem", {}, true);
    return;
  }

  if (!name) {
    setMessage("validation.enterName", {}, true);
    customerName.focus();
    return;
  }

  if (!paymentMethod) {
    setMessage("validation.selectPayment", {}, true);
    paymentMethodInputs[0]?.focus();
    return;
  }

  setMessage();
  orderSummary.innerHTML = `
    <strong>${escapeHtml(t("order.confirmFor", { name }))}</strong>
    <ul>
      ${rows.map((item) => `<li>${item.quantity} x ${escapeHtml(getDisplayName(item))} - ${formatEuro(item.price * item.quantity)}</li>`).join("")}
    </ul>
    <p><strong>${escapeHtml(t("order.total", { total: formatEuro(getTotal(rows)) }))}</strong></p>
    <p>${escapeHtml(t("order.paymentMethod"))}: <strong>${escapeHtml(getPaymentLabel(paymentMethod))}</strong></p>
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
}

async function submitOrder() {
  if (placeOrder.disabled) return;

  const rows = getCartRows();
  const name = customerName.value.trim();
  const paymentMethod = getSelectedPaymentMethod();

  if (!rows.length) {
    setMessage("validation.addItem", {}, true);
    return;
  }

  if (!name) {
    setMessage("validation.enterName", {}, true);
    customerName.focus();
    return;
  }

  if (!paymentMethod) {
    setMessage("validation.selectPayment", {}, true);
    paymentMethodInputs[0]?.focus();
    return;
  }

  if (paymentMethod === "wallet" && !currentCustomerProfile) {
    setMessage("validation.walletSignIn", {}, true);
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
  const { data: order, error } = paymentMethod === "wallet"
    ? await window.elimSupabase.rpc("create_wallet_order", {
        p_customer_name: name,
        p_items: orderItems
      })
    : await window.elimSupabase.rpc("create_order", {
        p_customer_name: name,
        p_payment_method: paymentMethod,
        p_items: orderItems
      });

  if (error || !order?.order_number) {
    console.error("Supabase RPC error while creating order:", error || order);
    placeOrder.disabled = false;
    setMessage("error.orderFailed", {}, true);
    return;
  }

  lastConfirmation = {
    orderNumber: order.order_number,
    totalPrice: Number(order.total_price),
    newBalance: paymentMethod === "wallet" ? Number(order.balance) : null
  };
  if (paymentMethod === "wallet") {
    currentCustomerBalance = Number(order.balance);
    renderCustomerAccount();
  }
  renderConfirmation();
  confirmationScreen.hidden = false;

  cart.clear();
  customerName.value = currentCustomerProfile?.display_name || "";
  paymentMethodInputs.forEach((input) => {
    input.checked = false;
  });
  renderPaymentInstructions();
  hideOrderActions();
  renderMenu();
  renderCart();
}

function resetCart() {
  cart.clear();
  hideOrderActions();
  renderMenu();
  renderCart();
  renderPaymentInstructions();
}

async function copyPaymentDetail(detail) {
  const config = window.ELIM_PAYMENT_CONFIG;
  const value = detail === "iban" ? config.sepaIban : config.sepaAccountHolder;

  try {
    await navigator.clipboard.writeText(value);
    setMessage(detail === "iban" ? "copy.ibanSuccess" : "copy.accountHolderSuccess");
  } catch (error) {
    console.error("Could not copy payment detail:", error);
    setMessage("copy.failed", {}, true);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, id } = button.dataset;
  const variant = button.dataset.variant || null;

  if (button.dataset.copy) {
    copyPaymentDetail(button.dataset.copy);
    return;
  }

  if (action === "increase") updateQuantity(id, variant, 1);
  if (action === "decrease") updateQuantity(id, variant, -1);
  if (action === "remove") {
    cart.delete(getCartKey(id, variant));
    hideOrderActions();
    renderMenu();
    renderCart();
  }
});

customerName.addEventListener("input", () => {
  hideOrderActions();
  setMessage("");
});

paymentMethodInputs.forEach((input) => {
  input.addEventListener("change", () => {
    hideOrderActions();
    setMessage("");
    renderPaymentInstructions();
  });
});

reviewOrder.addEventListener("click", renderSummary);
placeOrder.addEventListener("click", submitOrder);
clearCart.addEventListener("click", resetCart);
customerAccountOpen.addEventListener("click", openCustomerAuth);
customerAuthClose.addEventListener("click", closeCustomerAuth);
customerSignInForm.addEventListener("submit", signInCustomer);
customerSignUpForm.addEventListener("submit", signUpCustomer);
customerSignOut.addEventListener("click", signOutCustomer);
customerAuthModeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});
customerAuthOverlay.addEventListener("click", (event) => {
  if (event.target === customerAuthOverlay) closeCustomerAuth();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !customerAuthOverlay.hidden) closeCustomerAuth();
});
newOrder.addEventListener("click", () => {
  confirmationScreen.hidden = true;
});

document.addEventListener("elim:languagechange", () => {
  const preservedMessage = currentMessage;

  renderMenu();
  renderCart();
  renderPaymentInstructions();
  if (!orderSummary.hidden) renderSummary();
  renderConfirmation();
  renderCustomerAccount();
  customerAuthMessage.textContent = authMessage.key ? t(authMessage.key) : "";

  currentMessage = preservedMessage;
  refreshMessage();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20261101");
  });
}

renderMenu();
renderCart();
renderCustomerAccount();
initializeCustomerAuth();
