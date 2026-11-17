(function initializeStaffMenuManagement() {
  const view = document.querySelector("#staff-menu-view");
  if (!view) return;

  const list = document.querySelector("#menu-management-list");
  const message = document.querySelector("#menu-management-message");
  const addButton = document.querySelector("#menu-add-button");
  const form = document.querySelector("#menu-item-form");
  const cancelButton = document.querySelector("#menu-form-cancel");
  const fields = {
    id: document.querySelector("#menu-item-id"),
    name: document.querySelector("#menu-item-name"),
    category: document.querySelector("#menu-item-category"),
    price: document.querySelector("#menu-item-price"),
    variantMode: document.querySelector("#menu-item-variant-mode"),
    displayOrder: document.querySelector("#menu-item-display-order"),
    active: document.querySelector("#menu-item-active"),
    soldOut: document.querySelector("#menu-item-sold-out")
  };
  const t = (key, variables = {}) => window.ELIM_STAFF_I18N?.t(key, variables) || key;

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatEuro(value) {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(value));
  }

  function setMessage(text = "", isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function variantDescription(item) {
    if (item.variant_mode === "hot_ice") return `${t("variant.hot")} ${formatEuro(item.price)} / ${t("variant.ice")} ${formatEuro(item.price + 0.5)}`;
    if (item.variant_mode === "hot_only") return `${t("menu.hotOnly")} · ${formatEuro(item.price)}`;
    return `${t("menu.standard")} · ${formatEuro(item.price)}`;
  }

  function render() {
    const groups = window.ELIM_MENU_STORE.grouped({ includeInactive: true });
    if (!groups.length) {
      list.className = "menu-management-list empty-state";
      list.textContent = t("menu.empty");
      return;
    }
    list.className = "menu-management-list";
    list.innerHTML = groups.map((group) => `
      <section class="menu-management-group">
        <h3>${escapeHtml(t(`category.${group.category.toLowerCase()}`))}</h3>
        <div class="menu-management-items">
          ${group.items.map((item) => `
            <article class="menu-management-card ${!item.active ? "is-archived" : ""} ${item.sold_out ? "is-sold-out" : ""}">
              <div>
                <div class="menu-management-title-row">
                  <h4>${escapeHtml(item.name)}</h4>
                  <span class="pill">${escapeHtml(item.category)}</span>
                  ${!item.active ? `<span class="menu-state archived">${escapeHtml(t("menu.hidden"))}</span>` : ""}
                  ${item.active && item.sold_out ? `<span class="menu-state sold-out">${escapeHtml(t("menu.soldOut"))}</span>` : ""}
                </div>
                <p>${escapeHtml(variantDescription(item))}</p>
                <small>ID: ${escapeHtml(item.id)} · ${escapeHtml(t("menu.displayOrder"))}: ${item.display_order}</small>
              </div>
              <div class="menu-management-actions">
                <button class="secondary-button small-button" type="button" data-menu-action="sold-out" data-menu-id="${escapeHtml(item.id)}" ${!item.active ? "disabled" : ""}>${escapeHtml(item.sold_out ? t("menu.available") : t("menu.soldOut"))}</button>
                <button class="secondary-button small-button" type="button" data-menu-action="edit" data-menu-id="${escapeHtml(item.id)}">${escapeHtml(t("common.edit"))}</button>
                <button class="secondary-button small-button" type="button" data-menu-action="active" data-menu-id="${escapeHtml(item.id)}">${escapeHtml(item.active ? t("menu.hide") : t("menu.restore"))}</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  function setDefaultVariantForCategory() {
    if (fields.id.value) return;
    fields.variantMode.value = fields.category.value === "Ade" ? "standard" : "hot_ice";
  }

  function openCreateForm() {
    form.reset();
    fields.id.value = "";
    fields.category.value = "Coffee";
    fields.variantMode.value = "hot_ice";
    fields.displayOrder.value = "0";
    fields.active.checked = true;
    fields.soldOut.checked = false;
    form.hidden = false;
    fields.name.focus();
  }

  function openEditForm(item) {
    fields.id.value = item.id;
    fields.name.value = item.name;
    fields.category.value = item.category;
    fields.price.value = Number(item.price).toFixed(2);
    fields.variantMode.value = item.variant_mode;
    fields.displayOrder.value = item.display_order;
    fields.active.checked = item.active;
    fields.soldOut.checked = item.sold_out;
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    form.hidden = true;
    form.reset();
    fields.id.value = "";
  }

  async function saveItem(event) {
    event.preventDefault();
    const price = Number(fields.price.value);
    const displayOrder = Number(fields.displayOrder.value);
    if (!fields.name.value.trim() || !Number.isFinite(price) || price < 0) {
      setMessage(t("menu.validationError"), true);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage(t("menu.saving"));
    const editing = Boolean(fields.id.value);
    const rpcName = editing ? "staff_update_menu_item" : "staff_create_menu_item";
    const params = editing ? {
      p_id: fields.id.value,
      p_name: fields.name.value.trim(),
      p_category: fields.category.value,
      p_price: price,
      p_variant_mode: fields.variantMode.value,
      p_sold_out: fields.soldOut.checked,
      p_active: fields.active.checked,
      p_display_order: displayOrder
    } : {
      p_name: fields.name.value.trim(),
      p_category: fields.category.value,
      p_price: price,
      p_variant_mode: fields.variantMode.value,
      p_display_order: displayOrder
    };
    const { error } = await window.elimSupabase.rpc(rpcName, params);
    submit.disabled = false;
    if (error) {
      console.error("Could not save menu item:", error);
      setMessage(`${t("menu.saveError")} ${error.message}`, true);
      return;
    }
    await window.ELIM_MENU_STORE.load({ allowFallback: false });
    closeForm();
    setMessage(t(editing ? "menu.updated" : "menu.created"));
  }

  async function runAction(action, item) {
    const rpcName = action === "sold-out" ? "staff_set_menu_sold_out" : "staff_set_menu_active";
    const params = action === "sold-out"
      ? { p_id: item.id, p_sold_out: !item.sold_out }
      : { p_id: item.id, p_active: !item.active };
    setMessage(t("menu.saving"));
    const { error } = await window.elimSupabase.rpc(rpcName, params);
    if (error) {
      console.error("Could not update menu state:", error);
      setMessage(`${t("menu.saveError")} ${error.message}`, true);
      return;
    }
    await window.ELIM_MENU_STORE.load({ allowFallback: false });
    setMessage(t("menu.updated"));
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-action]");
    if (!button) return;
    const item = window.ELIM_MENU_STORE.find(button.dataset.menuId);
    if (!item) return;
    if (button.dataset.menuAction === "edit") openEditForm(item);
    else runAction(button.dataset.menuAction, item);
  });
  addButton.addEventListener("click", openCreateForm);
  cancelButton.addEventListener("click", closeForm);
  fields.category.addEventListener("change", setDefaultVariantForCategory);
  form.addEventListener("submit", saveItem);
  document.addEventListener("elim:staffviewchange", (event) => {
    if (event.detail?.view === "menu-management") render();
  });
  document.addEventListener("elim:staff-languagechange", render);
  const unsubscribe = window.ELIM_MENU_STORE.subscribe(render);
  window.addEventListener("pagehide", () => unsubscribe(), { once: true });
  render();
})();
