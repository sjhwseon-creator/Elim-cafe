const cart = new Map();

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

const PAYMENT_LABELS = {
  paypal: "PayPal",
  sepa: "SEPA bank transfer",
  cash: "Cash"
};

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

function getCartRows() {
  return Array.from(cart.entries())
    .map(([id, quantity]) => ({ ...getMenuItem(id), quantity }))
    .filter((item) => item.quantity > 0);
}

function getTotal(rows = getCartRows()) {
  return rows.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getSelectedPaymentMethod() {
  return document.querySelector('input[name="payment-method"]:checked')?.value || "";
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
    paymentInstructions.innerHTML = `
      <p>Please scan the PayPal QR code displayed at the café counter and send your payment.</p>
      <p>Alternatively, you can send the payment directly to the following PayPal account.</p>
      <dl class="payment-details">
        <div><dt>PayPal account</dt><dd>${escapeHtml(config.paypalAccount)}</dd></div>
      </dl>
    `;
  }

  if (method === "sepa") {
    paymentInstructions.innerHTML = `
      <p>Please scan the bank transfer QR code displayed at the café counter.</p>
      <p>Alternatively, you can transfer the payment directly using the following bank details.</p>
      <dl class="payment-details">
        <div><dt>Bank name</dt><dd>${escapeHtml(config.bankName)}</dd></div>
        <div>
          <dt>Account holder</dt>
          <dd><span>${escapeHtml(config.sepaAccountHolder)}</span><button class="copy-button" type="button" data-copy="account-holder">Copy</button></dd>
        </div>
        <div>
          <dt>IBAN</dt>
          <dd><span>${escapeHtml(config.sepaIban)}</span><button class="copy-button" type="button" data-copy="iban">Copy</button></dd>
        </div>
        <div><dt>Total amount</dt><dd>${formatEuro(getTotal())}</dd></div>
      </dl>
    `;
  }

  if (method === "cash") {
    paymentInstructions.innerHTML = "<p>Please pay in cash at the café counter.</p>";
  }

  paymentInstructions.hidden = false;
}

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function hideOrderActions() {
  orderSummary.hidden = true;
  placeOrder.hidden = true;
  placeOrder.disabled = false;
}

function updateQuantity(id, change) {
  const nextQuantity = Math.max(0, (cart.get(id) || 0) + change);

  if (nextQuantity === 0) {
    cart.delete(id);
  } else {
    cart.set(id, nextQuantity);
  }

  hideOrderActions();
  renderMenu();
  renderCart();
  renderPaymentInstructions();
}

function renderMenu() {
  menuGroups.innerHTML = window.ELIM_MENU.map((group) => `
    <div class="menu-group">
      <h3 class="category-title">${group.category}</h3>
      <div class="menu-list">
        ${group.items.map((item) => {
          const quantity = cart.get(item.id) || 0;
          return `
            <article class="menu-item">
              <div>
                <p class="item-name">${item.name}</p>
                <p class="item-price">${formatEuro(item.price)}</p>
              </div>
              <div class="quantity-controls" aria-label="${item.name} quantity">
                <button class="qty-button" type="button" data-action="decrease" data-id="${item.id}" aria-label="Remove one ${item.name}" ${quantity === 0 ? "disabled" : ""}>-</button>
                <span class="qty-value">${quantity}</span>
                <button class="qty-button" type="button" data-action="increase" data-id="${item.id}" aria-label="Add one ${item.name}">+</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `).join("");
}

function renderCart() {
  const rows = getCartRows();
  const itemCount = rows.reduce((sum, item) => sum + item.quantity, 0);

  cartCount.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  cartTotal.textContent = formatEuro(getTotal(rows));
  reviewOrder.disabled = itemCount === 0;
  clearCart.disabled = itemCount === 0;

  if (rows.length === 0) {
    cartItems.className = "cart-items empty-state";
    cartItems.textContent = "Your selected drinks will appear here.";
    setMessage("");
    return;
  }

  cartItems.className = "cart-items";
  cartItems.innerHTML = rows.map((item) => `
    <article class="cart-item">
      <div>
        <p class="item-name">${item.name}</p>
        <p class="item-meta">${item.quantity} x ${formatEuro(item.price)} = ${formatEuro(item.price * item.quantity)}</p>
      </div>
      <div class="cart-actions">
        <div class="quantity-controls" aria-label="${item.name} cart quantity">
          <button class="qty-button" type="button" data-action="decrease" data-id="${item.id}" aria-label="Remove one ${item.name}">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-button" type="button" data-action="increase" data-id="${item.id}" aria-label="Add one ${item.name}">+</button>
        </div>
        <button class="remove-button" type="button" data-action="remove" data-id="${item.id}">Remove</button>
      </div>
    </article>
  `).join("");
}

function renderSummary() {
  const rows = getCartRows();
  const name = customerName.value.trim();
  const paymentMethod = getSelectedPaymentMethod();

  if (!rows.length) {
    setMessage("Please add at least one item.", true);
    return;
  }

  if (!name) {
    setMessage("Please enter your name before ordering.", true);
    customerName.focus();
    return;
  }

  if (!paymentMethod) {
    setMessage("Please select a payment method before ordering.", true);
    paymentMethodInputs[0]?.focus();
    return;
  }

  setMessage("");
  orderSummary.innerHTML = `
    <strong>Confirm order for ${escapeHtml(name)}</strong>
    <ul>
      ${rows.map((item) => `<li>${item.quantity} x ${item.name} - ${formatEuro(item.price * item.quantity)}</li>`).join("")}
    </ul>
    <p><strong>Total: ${formatEuro(getTotal(rows))}</strong></p>
    <p>Payment method: <strong>${PAYMENT_LABELS[paymentMethod]}</strong></p>
  `;
  orderSummary.hidden = false;
  placeOrder.hidden = false;
}

async function getNextOrderNumber() {
  const { data, error } = await window.elimSupabase
    .from("orders")
    .select("order_number")
    .order("order_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Supabase error while getting next order number:", error);
    throw new Error(`Could not create order number: ${error.message}`);
  }

  const lastOrderNumber = Number(data?.[0]?.order_number || 99);
  return lastOrderNumber + 1;
}

async function insertOrderWithNumber(orderDetails) {
  let orderNumber = await getNextOrderNumber();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data: order, error } = await window.elimSupabase
      .from("orders")
      .insert({
        ...orderDetails,
        order_number: orderNumber
      })
      .select("id, order_number, total_price, payment_method")
      .single();

    if (!error) return order;

    console.error(`Supabase error while creating order, attempt ${attempt}:`, error);

    if (error.code !== "23505" || attempt === 3) {
      throw new Error(error.message);
    }

    orderNumber += 1;
  }

  throw new Error("Could not create a unique order number.");
}

async function submitOrder() {
  if (placeOrder.disabled) return;

  const rows = getCartRows();
  const name = customerName.value.trim();
  const total = getTotal(rows);
  const paymentMethod = getSelectedPaymentMethod();

  if (!rows.length) {
    setMessage("Please add at least one item.", true);
    return;
  }

  if (!name) {
    setMessage("Please enter your name before ordering.", true);
    customerName.focus();
    return;
  }

  if (!paymentMethod) {
    setMessage("Please select a payment method before ordering.", true);
    paymentMethodInputs[0]?.focus();
    return;
  }

  if (!window.elimSupabaseConfigured || !window.elimSupabase) {
    setMessage("Add your Supabase URL and anon key in js/supabase-config.js before placing orders.", true);
    return;
  }

  placeOrder.disabled = true;
  setMessage("Sending your order...");

  let order;

  try {
    order = await insertOrderWithNumber({
      customer_name: name,
      total_price: total,
      status: "new",
      payment_method: paymentMethod
    });
  } catch (error) {
    console.error("Order submission failed:", error);
    placeOrder.disabled = false;
    setMessage(`Could not place order: ${error.message}`, true);
    return;
  }

  const orderItems = rows.map((item) => ({
    order_id: order.id,
    item_name: item.name,
    quantity: item.quantity,
    unit_price: item.price
  }));

  const { error: itemsError } = await window.elimSupabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.error("Supabase error while creating order items:", itemsError);
    placeOrder.disabled = false;
    setMessage(`Order was created, but the items could not be saved: ${itemsError.message}`, true);
    return;
  }

  confirmationNumber.textContent = `Order #${order.order_number}`;
  confirmationTotal.textContent = `Total: ${formatEuro(Number(order.total_price))}`;
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
    setMessage(`${detail === "iban" ? "IBAN" : "Account holder"} copied.`);
  } catch (error) {
    console.error("Could not copy payment detail:", error);
    setMessage("Could not copy automatically. Please select and copy the text.", true);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, id } = button.dataset;

  if (button.dataset.copy) {
    copyPaymentDetail(button.dataset.copy);
    return;
  }

  if (action === "increase") updateQuantity(id, 1);
  if (action === "decrease") updateQuantity(id, -1);
  if (action === "remove") {
    cart.delete(id);
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20260925");
  });
}

renderMenu();
renderCart();
