(function initializeMenuStore() {
  const CATEGORY_ORDER = ["Coffee", "Latte", "Ade"];
  const listeners = new Set();
  let items = [];
  let source = "none";
  let realtimeChannel = null;
  let reloadTimer = null;
  let loadPromise = null;

  function normalizeItem(item) {
    const variantMode = item.variant_mode || (item.variants?.length ? "hot_ice" : (item.id === "espresso" ? "hot_only" : "standard"));
    return {
      id: String(item.id),
      category: item.category,
      name: item.name,
      price: Number(item.price),
      active: item.active !== false,
      sold_out: item.sold_out === true,
      variant_mode: variantMode,
      display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : 0,
      variants: variantMode === "hot_ice" ? ["hot", "ice"] : []
    };
  }

  function sortItems(list) {
    return [...list].sort((left, right) => {
      const leftCategory = CATEGORY_ORDER.indexOf(left.category);
      const rightCategory = CATEGORY_ORDER.indexOf(right.category);
      return (leftCategory === -1 ? 99 : leftCategory) - (rightCategory === -1 ? 99 : rightCategory)
        || left.display_order - right.display_order
        || left.name.localeCompare(right.name);
    });
  }

  function fallbackItems() {
    return (window.ELIM_MENU_FALLBACK || window.ELIM_MENU || [])
      .flatMap((group) => group.items.map((item, index) => normalizeItem({
        ...item,
        category: group.category,
        display_order: item.display_order ?? index + 1
      })));
  }

  function grouped({ includeInactive = false } = {}) {
    const visible = items.filter((item) => includeInactive || item.active);
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: visible.filter((item) => item.category === category)
    })).filter((group) => group.items.length);
  }

  function publish(reason = "update") {
    window.ELIM_MENU = grouped();
    listeners.forEach((listener) => listener({ items: [...items], groups: grouped(), source, reason }));
    document.dispatchEvent(new CustomEvent("elim:menuchange", { detail: { source, reason } }));
  }

  async function load({ allowFallback = true } = {}) {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      if (!window.elimSupabaseConfigured || !window.elimSupabase) {
        if (allowFallback && !items.length) {
          items = sortItems(fallbackItems());
          source = "fallback";
          publish("fallback");
        }
        return { items: [...items], source, error: new Error("Supabase is not configured") };
      }

      const { data, error } = await window.elimSupabase
        .from("menu_items")
        .select("id, category, name, price, active, sold_out, variant_mode, display_order");

      if (error) {
        console.error("Could not load menu items:", error);
        if (allowFallback && !items.length) {
          items = sortItems(fallbackItems());
          source = "fallback";
          publish("fallback");
        }
        return { items: [...items], source, error };
      }

      items = sortItems((data || []).map(normalizeItem));
      source = "supabase";
      publish("load");
      return { items: [...items], source, error: null };
    })().finally(() => { loadPromise = null; });
    return loadPromise;
  }

  function scheduleReload() {
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => load({ allowFallback: false }), 120);
  }

  function startRealtime() {
    if (realtimeChannel || !window.elimSupabase) return realtimeChannel;
    realtimeChannel = window.elimSupabase
      .channel("elim-cafe-menu-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, scheduleReload)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.error("Menu Realtime subscription failed.");
      });
    return realtimeChannel;
  }

  async function stopRealtime() {
    window.clearTimeout(reloadTimer);
    if (!realtimeChannel || !window.elimSupabase) return;
    const channel = realtimeChannel;
    realtimeChannel = null;
    await window.elimSupabase.removeChannel(channel);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function find(itemId) {
    return items.find((item) => item.id === itemId) || null;
  }

  items = sortItems(fallbackItems());
  source = "fallback";
  window.ELIM_MENU = grouped();
  window.ELIM_MENU_STORE = {
    CATEGORY_ORDER,
    find,
    grouped,
    items: () => [...items],
    load,
    source: () => source,
    startRealtime,
    stopRealtime,
    subscribe
  };
})();
