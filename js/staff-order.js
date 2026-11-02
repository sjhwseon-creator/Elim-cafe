(function initializeStaffGuestOrder() {
  const menuRoot = document.querySelector("#staff-order-menu");
  if (!menuRoot) return;

  const cartRoot = document.querySelector("#staff-order-cart-items");
  const cartCount = document.querySelector("#staff-order-cart-count");
  const totalElement = document.querySelector("#staff-order-total");
  const customerName = document.querySelector("#staff-order-customer-name");
  const submitButton = document.querySelector("#staff-order-submit");
  const clearButton = document.querySelector("#staff-order-clear");
  const messageElement = document.querySelector("#staff-order-message");
  const guestTotal = document.querySelector("#guest-account-total");
  const guestOrderCount = document.querySelector("#guest-account-order-count");
  const cart = new Map();

  function formatEuro(value) {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMessage(message = "", isError = false) {
    messageElement.textContent = message;
    messageElement.classList.toggle("error", isError);
  }

  function cartKey(itemId, variant = null) {
    return `${itemId}::${variant || "standard"}`;
  }

  function parseCartKey(key) {
    const separator = key.lastIndexOf("::");
    const variant = key.slice(separator + 2);
    return {
      itemId: key.slice(0, separator),
      variant: variant === "standard" ? null : variant
    };
  }

  function menuItem(itemId) {
    return window.ELIM_MENU.flatMap((group) => group.items).find((item) => item.id === itemId);
  }

  function variantPrice(item, variant) {
    return Number(item.price) + (variant === "ice" ? 0.5 : 0);
  }

  function quantity(itemId, variant = null) {
    return cart.get(cartKey(itemId, variant)) || 0;
  }

  function cartRows() {
    return Array.from(cart.entries()).map(([key, selectedQuantity]) => {
      const { itemId, variant } = parseCartKey(key);
      const item = menuItem(itemId);
      return item ? {
        ...item,
        variant,
        quantity: selectedQuantity,
        selectedPrice: variantPrice(item, variant)
      } : null;
    }).filter(Boolean);
  }

  function orderTotal(rows = cartRows()) {
    return rows.reduce((total, item) => total + item.selectedPrice * item.quantity, 0);
  }

  function itemLabel(item) {
    return item.variant ? `${item.name} (${item.variant.toUpperCase()})` : item.name;
  }

  function quantityControls(item, variant = null) {
    const selectedQuantity = quantity(item.id, variant);
    const label = variant ? `${item.name} ${variant}` : item.name;
    return `
      <div class="staff-order-quantity" aria-label="${escapeHtml(label)} quantity">
        <button type="button" data-guest-action="decrease" data-item-id="${escapeHtml(item.id)}" data-variant="${variant || ""}" ${selectedQuantity === 0 ? "disabled" : ""}>−</button>
        <strong>${selectedQuantity}</strong>
        <button type="button" data-guest-action="increase" data-item-id="${escapeHtml(item.id)}" data-variant="${variant || ""}">+</button>
      </div>
    `;
  }

  function renderMenu() {
    menuRoot.innerHTML = window.ELIM_MENU.map((group) => `
      <section class="staff-order-category category-${group.category.toLowerCase()}">
        <h4>${escapeHtml(group.category)}</h4>
        <div class="staff-order-menu-items">
          ${group.items.map((item) => {
            if (item.variants?.length) {
              return `
                <article class="staff-order-menu-item has-variants">
                  <strong>${escapeHtml(item.name)}</strong>
                  <div class="staff-order-variants">
                    ${item.variants.map((variant) => `
                      <div class="staff-order-variant">
                        <span>${variant.toUpperCase()} · ${formatEuro(variantPrice(item, variant))}</span>
                        ${quantityControls(item, variant)}
                      </div>
                    `).join("")}
                  </div>
                </article>
              `;
            }
            return `
              <article class="staff-order-menu-item">
                <span><strong>${escapeHtml(item.name)}</strong><small>${formatEuro(item.price)}</small></span>
                ${quantityControls(item)}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `).join("");
  }

  function renderCart() {
    const rows = cartRows();
    const count = rows.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = `${count} item${count === 1 ? "" : "s"}`;
    totalElement.textContent = formatEuro(orderTotal(rows));
    submitButton.disabled = count === 0;
    clearButton.disabled = count === 0;

    if (!rows.length) {
      cartRoot.className = "staff-order-cart-items empty-state";
      cartRoot.textContent = "Selected drinks will appear here.";
      return;
    }

    cartRoot.className = "staff-order-cart-items";
    cartRoot.innerHTML = rows.map((item) => `
      <article class="staff-order-cart-row">
        <span><strong>${escapeHtml(itemLabel(item))}</strong><small>${item.quantity} × ${formatEuro(item.selectedPrice)}</small></span>
        <strong>${formatEuro(item.quantity * item.selectedPrice)}</strong>
        <button type="button" data-guest-action="remove" data-item-id="${escapeHtml(item.id)}" data-variant="${item.variant || ""}" aria-label="Remove ${escapeHtml(itemLabel(item))}">×</button>
      </article>
    `).join("");
  }

  function updateQuantity(itemId, variant, change) {
    const key = cartKey(itemId, variant);
    const nextQuantity = Math.max(0, (cart.get(key) || 0) + change);
    if (nextQuantity) cart.set(key, nextQuantity);
    else cart.delete(key);
    setMessage();
    renderMenu();
    renderCart();
  }

  function clearCart() {
    cart.clear();
    setMessage();
    renderMenu();
    renderCart();
  }

  async function loadGuestAccount() {
    if (!window.elimSupabaseConfigured || !window.elimSupabase) return;
    const { data, error } = await window.elimSupabase
      .from("guest_accounts")
      .select("total_ordered, order_count")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("Could not load Guest account:", error);
      setMessage(`Could not load Guest account: ${error.message}`, true);
      return;
    }
    guestTotal.textContent = formatEuro(data?.total_ordered || 0);
    guestOrderCount.textContent = String(data?.order_count || 0);
  }

  async function submitGuestOrder() {
    if (submitButton.disabled) return;
    const rows = cartRows();
    const name = customerName.value.trim() || "Guest";
    const paymentMethod = document.querySelector('input[name="staff-order-payment"]:checked')?.value || "cash";

    submitButton.disabled = true;
    clearButton.disabled = true;
    setMessage("Saving Guest order...");

    const { data, error } = await window.elimSupabase.rpc("staff_create_guest_order", {
      p_customer_name: name,
      p_payment_method: paymentMethod,
      p_items: rows.map((item) => ({
        item_id: item.id,
        variant: item.variant,
        quantity: item.quantity
      }))
    });

    if (error || !data?.order_number) {
      console.error("Could not create Guest order:", error || data);
      submitButton.disabled = false;
      clearButton.disabled = false;
      setMessage(`Could not place Guest order: ${error?.message || "Unexpected response"}`, true);
      return;
    }

    guestTotal.textContent = formatEuro(data.guest_total_ordered || 0);
    guestOrderCount.textContent = String(data.guest_order_count || 0);
    cart.clear();
    customerName.value = "Guest";
    renderMenu();
    renderCart();
    setMessage(`Order #${data.order_number} received · ${formatEuro(data.total_price)} · ${paymentMethod.toUpperCase()}. It is queued for automatic category printing.`);
    document.dispatchEvent(new CustomEvent("elim:guestordercreated", { detail: data }));
  }

  function handleQuantityClick(event) {
    const button = event.target.closest("[data-guest-action]");
    if (!button) return;
    const itemId = button.dataset.itemId;
    const variant = button.dataset.variant || null;
    if (button.dataset.guestAction === "increase") updateQuantity(itemId, variant, 1);
    if (button.dataset.guestAction === "decrease") updateQuantity(itemId, variant, -1);
    if (button.dataset.guestAction === "remove") {
      cart.delete(cartKey(itemId, variant));
      renderMenu();
      renderCart();
    }
  }

  menuRoot.addEventListener("click", handleQuantityClick);
  cartRoot.addEventListener("click", handleQuantityClick);
  submitButton.addEventListener("click", submitGuestOrder);
  clearButton.addEventListener("click", clearCart);
  document.addEventListener("elim:staffviewchange", (event) => {
    if (event.detail?.view === "guest-order") loadGuestAccount();
  });

  renderMenu();
  renderCart();
})();
