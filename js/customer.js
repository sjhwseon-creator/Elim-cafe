const cart = new Map();

async function forwardStaffAuthCallback() {
  if (!window.elimSupabase || !window.elimStaffAuthCallbackDetected) return;

  let redirected = false;
  const redirectToStaff = (session) => {
    if (!session || redirected) return;
    redirected = true;
    window.location.replace(new URL("staff.html", window.location.href).href);
  };

  const { data: authListener } = window.elimSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      redirectToStaff(session);
    }
  });

  const { data, error } = await window.elimCompleteAuthCallback();
  if (error) {
    console.error("Could not complete staff Magic Link redirect:", error);
    authListener.subscription.unsubscribe();
    return;
  }

  redirectToStaff(data.session);

  if (!redirected) {
    window.setTimeout(() => authListener.subscription.unsubscribe(), 10000);
  }
}

forwardStaffAuthCallback();

const menuGroups = document.querySelector("#menu-groups");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const customerName = document.querySelector("#customer-name");
const paymentMethodInputs = document.querySelectorAll('input[name="payment-method"]');
const paymentInstructions = document.querySelector("#payment-instructions");
const reviewOrder = document.querySelector("#review-order");
const placeOrder = document.querySelector("#place-order");
const clearCart = document.querySelector("#clear-cart");
const orderSummary = document.querySelector("#order-summary");
const formMessage = document.querySelector("#form-message");
const confirmationScreen = document.querySelector("#confirmation-screen");
const confirmationNumber = document.querySelector("#confirmation-number");
const confirmationTotal = document.querySelector("#confirmation-total");
const newOrder = document.querySelector("#new-order");

let currentMessage = { key: "", variables: {}, isError: false };
let lastConfirmation = null;

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  if (!window.elimSupabaseConfigured || !window.elimSupabase) {
    setMessage("error.serviceUnavailable", {}, true);
    return;
  }

  placeOrder.disabled = true;
  setMessage("order.sending");

  const { data: order, error } = await window.elimSupabase.rpc("create_order", {
    p_customer_name: name,
    p_payment_method: paymentMethod,
    p_items: rows.map((item) => ({
      item_id: item.id,
      variant: item.variant,
      quantity: item.quantity
    }))
  });

  if (error || !order?.order_number) {
    console.error("Supabase RPC error while creating order:", error || order);
    placeOrder.disabled = false;
    setMessage("error.orderFailed", {}, true);
    return;
  }

  lastConfirmation = {
    orderNumber: order.order_number,
    totalPrice: Number(order.total_price)
  };
  renderConfirmation();
  confirmationScreen.hidden = false;

  cart.clear();
  customerName.value = "";
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

  currentMessage = preservedMessage;
  refreshMessage();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20261009-2");
  });
}

renderMenu();
renderCart();
