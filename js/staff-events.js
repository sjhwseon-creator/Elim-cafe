(function initializeSponsoredEvents() {
  const view = document.querySelector("#staff-sponsored-events-view");
  const form = document.querySelector("#sponsored-event-form");
  const sponsorInput = document.querySelector("#sponsored-event-sponsor");
  const messageInput = document.querySelector("#sponsored-event-message-input");
  const startInput = document.querySelector("#sponsored-event-start");
  const endInput = document.querySelector("#sponsored-event-end");
  const activateButton = document.querySelector("#activate-sponsored-event");
  const activePanel = document.querySelector("#active-sponsored-event");
  const historyList = document.querySelector("#sponsored-events-history");
  const message = document.querySelector("#sponsored-events-message");
  const refreshButton = document.querySelector("#refresh-sponsored-events");
  if (!view || !form) return;

  const t = (key, variables = {}) => window.ELIM_STAFF_I18N?.t(key, variables) || key;
  let events = [];
  let realtimeChannel = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatEuro(value) {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return t("events.notSet");
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function isCurrentlyActive(event) {
    if (!event?.active) return false;
    const now = Date.now();
    return (!event.starts_at || new Date(event.starts_at).getTime() <= now)
      && (!event.ends_at || new Date(event.ends_at).getTime() > now);
  }

  function currentEvent() {
    return events.find(isCurrentlyActive) || null;
  }

  function enabledEvent() {
    return events.find((event) => event.active) || null;
  }

  function eventStatus(event) {
    if (!event.active) return t("events.ended");
    if (event.starts_at && new Date(event.starts_at).getTime() > Date.now()) return t("events.scheduled");
    if (event.ends_at && new Date(event.ends_at).getTime() <= Date.now()) return t("events.timeEnded");
    return t("events.activeStatus");
  }

  function statsMarkup(event) {
    return `
      <div class="event-stats">
        <div><span>${escapeHtml(t("events.orders"))}</span><strong>${Number(event.order_count || 0)}</strong></div>
        <div><span>${escapeHtml(t("events.drinks"))}</span><strong>${Number(event.drink_count || 0)}</strong></div>
        <div><span>${escapeHtml(t("events.value"))}</span><strong>${formatEuro(event.sponsored_value)}</strong></div>
      </div>`;
  }

  function render() {
    const enabled = enabledEvent();
    form.hidden = Boolean(enabled);
    activePanel.hidden = !enabled;
    if (enabled) {
      activePanel.innerHTML = `
        <div class="event-status-line"><span class="event-status-dot" aria-hidden="true"></span><strong>${escapeHtml(eventStatus(enabled))}</strong></div>
        <h3>🎁 ${escapeHtml(enabled.sponsor_name)}</h3>
        ${enabled.message ? `<p>${escapeHtml(enabled.message)}</p>` : ""}
        <dl class="event-dates">
          <div><dt>${escapeHtml(t("events.start"))}</dt><dd>${escapeHtml(formatDate(enabled.starts_at))}</dd></div>
          <div><dt>${escapeHtml(t("events.end"))}</dt><dd>${escapeHtml(formatDate(enabled.ends_at))}</dd></div>
        </dl>
        ${statsMarkup(enabled)}
        <button class="danger-button small-button" type="button" data-end-sponsored-event="${escapeHtml(enabled.id)}">${escapeHtml(t("events.endEvent"))}</button>`;
    }

    const history = events.filter((event) => !event.active);
    if (!history.length) {
      historyList.className = "sponsored-events-history empty-state";
      historyList.textContent = t("events.nonePast");
    } else {
      historyList.className = "sponsored-events-history";
      historyList.innerHTML = history.map((event) => `
        <article class="event-history-card">
          <div><h4>${escapeHtml(event.sponsor_name)}</h4><span>${escapeHtml(eventStatus(event))}</span></div>
          ${event.message ? `<p>${escapeHtml(event.message)}</p>` : ""}
          ${statsMarkup(event)}
        </article>`).join("");
    }
  }

  function emitCurrentEvent() {
    document.dispatchEvent(new CustomEvent("elim:sponsoredeventchange", {
      detail: { event: currentEvent() }
    }));
  }

  async function loadEvents({ quiet = false } = {}) {
    if (!window.elimSupabase) return;
    if (!quiet) message.textContent = t("events.loading");
    const { data, error } = await window.elimSupabase.rpc("staff_list_sponsored_events");
    if (error) {
      console.error("Could not load Sponsored Events:", error);
      message.textContent = `${t("events.loadError")} ${error.message}`;
      message.classList.add("error");
      return;
    }
    message.classList.remove("error");
    if (!quiet) message.textContent = "";
    events = data || [];
    render();
    emitCurrentEvent();
    startRealtime();
  }

  function startRealtime() {
    if (realtimeChannel || !window.elimSupabase) return;
    realtimeChannel = window.elimSupabase
      .channel("elim-staff-sponsored-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "sponsored_events" }, () => loadEvents({ quiet: true }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => loadEvents({ quiet: true }))
      .subscribe();
  }

  async function createEvent(event) {
    event.preventDefault();
    activateButton.disabled = true;
    message.classList.remove("error");
    message.textContent = t("events.activating");
    const toIso = (value) => value ? new Date(value).toISOString() : null;
    const { error } = await window.elimSupabase.rpc("staff_create_sponsored_event", {
      p_sponsor_name: sponsorInput.value.trim(),
      p_message: messageInput.value.trim() || null,
      p_starts_at: toIso(startInput.value),
      p_ends_at: toIso(endInput.value)
    });
    activateButton.disabled = false;
    if (error) {
      console.error("Could not activate Sponsored Event:", error);
      message.textContent = `${t("events.activateError")} ${error.message}`;
      message.classList.add("error");
      return;
    }
    form.reset();
    message.textContent = t("events.activated");
    await loadEvents({ quiet: true });
  }

  async function endEvent(eventId, button) {
    if (!window.confirm(t("events.endConfirm"))) return;
    button.disabled = true;
    message.textContent = t("events.ending");
    const { error } = await window.elimSupabase.rpc("staff_end_sponsored_event", { p_event_id: eventId });
    if (error) {
      console.error("Could not end Sponsored Event:", error);
      message.textContent = `${t("events.endError")} ${error.message}`;
      message.classList.add("error");
      button.disabled = false;
      return;
    }
    message.classList.remove("error");
    message.textContent = t("events.endedSuccess");
    await loadEvents({ quiet: true });
  }

  form.addEventListener("submit", createEvent);
  refreshButton.addEventListener("click", () => loadEvents());
  activePanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-end-sponsored-event]");
    if (button) endEvent(button.dataset.endSponsoredEvent, button);
  });
  document.addEventListener("elim:staffviewchange", (event) => {
    if (["sponsored-events", "guest-order"].includes(event.detail?.view)) loadEvents();
  });
  document.addEventListener("elim:staff-languagechange", render);
  window.elimSupabase?.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_OUT") return;
    if (realtimeChannel) window.elimSupabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    events = [];
    render();
    emitCurrentEvent();
  });
  window.addEventListener("pagehide", () => {
    if (realtimeChannel) window.elimSupabase?.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }, { once: true });

  window.ELIM_SPONSORED_EVENTS = { refresh: loadEvents, getActive: currentEvent };
})();
