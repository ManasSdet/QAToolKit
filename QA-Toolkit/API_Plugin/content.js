(() => {
  const EVENT_CHANNEL = "__API_WATCHDOG_EVENT__";
  const CONFIG_CHANNEL = "__API_WATCHDOG_CONFIG__";
  const SLOW_THRESHOLD_MS = 3000;
  const MAX_EVENTS = 600;
  const MAX_PREVIEW_CHARS = 4000;

  if (window.__API_WATCHDOG_UI__) return;
  window.__API_WATCHDOG_UI__ = true;

  const host = location.hostname;
  const isProdLikeHost = (() => {
    const h = host.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
    if (h.endsWith(".local") || h.endsWith(".test") || h.endsWith(".internal")) return false;
    return !/(^|[-.])(dev|qa|test|staging|stage|uat|sandbox)([-.]|$)/.test(h);
  })();

  const state = {
    events: [],
    pages: [],
    filter: "all",
    selectedPageId: "all",
    currentPageId: null,
    enabled: false,
    initialized: false,
    panelOpen: false,
    deepCapture: false,
    prodOverride: false,
    isProdLikeHost
  };

  const pendingRawEvents = [];

  const runtimeMsg = (message) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve(null);
        resolve(response ?? null);
      });
    } catch {
      resolve(null);
    }
  });

  const randomId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const getPath = (url = location.href) => {
    try {
      const u = new URL(url, location.href);
      return `${u.pathname}${u.search}`;
    } catch {
      return String(url || "");
    }
  };

  const normalizeUrl = (url) => {
    try {
      const u = new URL(url, location.href);
      return `${u.origin}${u.pathname}`;
    } catch {
      return String(url || "").split("?")[0];
    }
  };

  const escaped = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const sensitiveHeader = (name) => {
    const key = String(name || "").toLowerCase();
    return key === "authorization" || key === "cookie" || key === "set-cookie" || key.includes("token") || key.includes("secret") || key.includes("key");
  };

  const redactHeaders = (headers) => (headers || []).map(([k, v]) => [String(k), sensitiveHeader(k) ? "[REDACTED]" : String(v)]);

  const redactBodyText = (value) => {
    if (value == null) return null;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return String(text)
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
      .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]")
      .replace(/("?(password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie)"?\s*[:=]\s*")([^"]+)(")/gi, "$1[REDACTED]$4")
      .slice(0, MAX_PREVIEW_CHARS);
  };

  const ensurePageExists = async (page) => {
    const existing = state.pages.find((p) => p.pageId === page.pageId);
    if (existing) Object.assign(existing, page);
    else state.pages.unshift(page);
    state.pages = state.pages.slice(0, 80);
    await runtimeMsg({ type: "aw:upsertPage", page });
  };

  const createPageSession = async () => {
    const page = {
      pageId: randomId(),
      url: location.href,
      path: getPath(),
      title: document.title || "",
      startedAt: new Date().toISOString()
    };
    state.currentPageId = page.pageId;
    await ensurePageExists(page);

    if (state.selectedPageId !== "all" && !state.pages.some((p) => p.pageId === state.selectedPageId)) {
      state.selectedPageId = "all";
    }

    render();
  };

  const setConfigToInjected = () => {
    const deepAllowed = state.enabled && state.deepCapture && (!state.isProdLikeHost || state.prodOverride);
    window.postMessage({
      channel: CONFIG_CHANNEL,
      payload: {
        enabled: state.enabled,
        deepCapture: deepAllowed,
        maxBodyChars: MAX_PREVIEW_CHARS
      }
    }, "*");
  };

  const hydrateFromTabSession = async () => {
    const session = await runtimeMsg({ type: "aw:getTabSession" });
    if (!session) return;

    if (Array.isArray(session.pages) && session.pages.length) state.pages = session.pages;

    if (Array.isArray(session.events) && session.events.length) {
      state.events = session.events.slice(0, MAX_EVENTS);
      for (const evt of state.events) {
        if (!evt.pageId) evt.pageId = "legacy";
      }
    }

    if (session.enabled === true) state.enabled = true;
    if (session.panelOpen === true) state.panelOpen = true;
  };

  const loadSettings = async () => {
    const stored = await chrome.storage.local.get(["awAllowedHosts", "awDeepCaptureHosts", "awProdOverrides"]);
    const allowed = stored.awAllowedHosts || {};
    const deep = stored.awDeepCaptureHosts || {};
    const prodOverrides = stored.awProdOverrides || {};

    state.enabled = Boolean(allowed[host]) || state.enabled;
    state.deepCapture = Boolean(deep[host]);
    state.prodOverride = Boolean(prodOverrides[host]);
  };

  const saveHostFlag = async (key, value) => {
    const stored = await chrome.storage.local.get([key]);
    const map = stored[key] || {};
    if (value) map[host] = true;
    else delete map[host];
    await chrome.storage.local.set({ [key]: map });
  };

  const copyText = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt || "");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = txt || "";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  };

  const formatMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} sec` : `${ms} ms`);
  const isFailed = (e) => e.status >= 400 || e.status === 0;
  const isSlow = (e) => e.durationMs >= SLOW_THRESHOLD_MS;

  const statusClass = (status) => {
    if (status === 0) return "status-error";
    if (status >= 500) return "status-error";
    if (status >= 400) return "status-warn";
    if (status >= 300) return "status-info";
    return "status-ok";
  };

  const pageLabel = (pageId) => {
    const page = state.pages.find((p) => p.pageId === pageId);
    if (!page) return "Unknown page";
    return page.path || page.url;
  };

  const getScopedEvents = () => {
    if (state.selectedPageId === "all") return state.events;
    return state.events.filter((e) => e.pageId === state.selectedPageId);
  };

  const buildDuplicateCountMap = (events) => {
    const map = new Map();
    for (const e of events) {
      const key = `${e.pageId || "unknown"}|${e.key || `${e.method} ${normalizeUrl(e.url)}`}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };

  const analyzeEvent = (event, dupMap) => {
    const dupKey = `${event.pageId || "unknown"}|${event.key || `${event.method} ${normalizeUrl(event.url)}`}`;
    const duplicateCount = dupMap.get(dupKey) || 0;
    const duplicate = duplicateCount > 1;
    const failed = isFailed(event);
    const slow = isSlow(event);
    const issueTypes = [];
    if (failed) issueTypes.push("FAILED");
    if (slow) issueTypes.push("SLOW");
    if (duplicate) issueTypes.push("DUPLICATE");

    return { duplicateCount, duplicate, failed, slow, issueTypes };
  };

  const getRows = () => {
    const scopeEvents = getScopedEvents();
    const dupMap = buildDuplicateCountMap(scopeEvents);

    if (state.filter === "duplicate") {
      const latestByKey = new Map();
      for (const e of scopeEvents) {
        const info = analyzeEvent(e, dupMap);
        if (!info.duplicate) continue;
        const dedupeKey = `${e.pageId}|${e.key}`;
        if (!latestByKey.has(dedupeKey)) latestByKey.set(dedupeKey, { ...e, __info: info });
      }
      return [...latestByKey.values()];
    }

    return scopeEvents
      .filter((e) => {
        const info = analyzeEvent(e, dupMap);
        if (state.filter === "failed") return info.failed;
        if (state.filter === "slow") return info.slow;
        return true;
      })
      .map((e) => ({ ...e, __info: analyzeEvent(e, dupMap) }));
  };

  const buildIssueExportRows = () => {
    const scopeEvents = getScopedEvents();
    const dupMap = buildDuplicateCountMap(scopeEvents);
    const exportedAt = new Date().toISOString();

    return scopeEvents
      .map((e) => {
        const info = analyzeEvent(e, dupMap);
        if (!info.issueTypes.length) return null;

        const page = state.pages.find((p) => p.pageId === e.pageId) || {};
        return {
          exportedAt,
          pageId: e.pageId || "",
          pageTitle: page.title || "",
          pagePath: page.path || "",
          pageUrl: page.url || "",
          timestamp: e.timestamp || "",
          method: e.method || "",
          apiUrl: e.url || "",
          statusCode: e.status,
          durationMs: e.durationMs,
          issueType: info.issueTypes.join(","),
          duplicateCount: info.duplicateCount,
          transport: e.transport || "",
          networkError: Boolean(e.networkError)
        };
      })
      .filter(Boolean);
  };

  const toCsv = (rows) => {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escapeCsv = (value) => {
      const v = value == null ? "" : String(value);
      if (v.includes(",") || v.includes("\n") || v.includes("\"")) {
        return `"${v.replaceAll("\"", "\"\"")}"`;
      }
      return v;
    };

    const lines = [headers.join(",")];
    for (const row of rows) lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
    return lines.join("\n");
  };

  const downloadCsv = (filename, csvContent) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toCurl = (e) => {
    const parts = ["curl", `-X ${e.method}`];
    for (const [k, v] of e.requestHeaders || []) parts.push(`-H ${JSON.stringify(`${k}: ${v}`)}`);
    if (e.requestBody) parts.push(`--data-raw ${JSON.stringify(e.requestBody)}`);
    parts.push(JSON.stringify(e.url));
    return parts.join(" ");
  };

  const getIssueCount = () => {
    const dupMap = buildDuplicateCountMap(state.events);
    const duplicatedGroups = [...dupMap.values()].filter((v) => v > 1).length;
    const failedOrSlow = state.events.filter((e) => isFailed(e) || isSlow(e)).length;
    return failedOrSlow + duplicatedGroups;
  };

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("API_Plugin/injected.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  const style = document.createElement("style");
  style.textContent = `
    #api-watchdog-badge { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; background:#111827; color:white; border-radius:999px; padding:8px 12px; font:12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; box-shadow:0 8px 20px rgba(0,0,0,.35); cursor:pointer; user-select:none; }
    #api-watchdog-panel { position: fixed; right:16px; bottom:56px; width:500px; max-height:78vh; background:#0b1220; color:#e5e7eb; z-index:2147483647; border:1px solid #1f2937; border-radius:12px; box-shadow:0 16px 40px rgba(0,0,0,.45); overflow:hidden; display:none; font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; }
    #api-watchdog-header { padding:10px 12px; border-bottom:1px solid #1f2937; display:flex; justify-content:space-between; align-items:center; font-weight:700; }
    #api-watchdog-security, #api-watchdog-pages, #api-watchdog-filters { padding:8px 12px; border-bottom:1px solid #1f2937; background:#0f172a; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    #api-watchdog-pages select { background:#111827; color:#e2e8f0; border:1px solid #334155; border-radius:6px; padding:4px 8px; min-width:260px; }
    .api-watchdog-btn { border:1px solid #334155; border-radius:6px; padding:6px 10px; cursor:pointer; color:#e2e8f0; background:#111827; font-size:11px; font-weight:600; pointer-events:auto; transition:all .15s ease; }
    .api-watchdog-btn:hover { border-color:#60a5fa; background:#1e293b; color:#fff; }
    .api-watchdog-btn:active { transform:translateY(1px); }
    .api-watchdog-btn.copy-ok { border-color:#16a34a; background:#14532d; color:#dcfce7; }
    .api-watchdog-btn.active { background:#1d4ed8; border-color:#1d4ed8; color:#fff; }
    .api-watchdog-btn.warn { border-color:#b45309; color:#fcd34d; }
    .api-watchdog-filter { border:1px solid #334155; border-radius:999px; padding:4px 10px; cursor:pointer; color:#e2e8f0; background:transparent; font-size:11px; }
    .api-watchdog-filter.active { background:#1d4ed8; border-color:#1d4ed8; color:#fff; }
    #api-watchdog-alert { padding:8px 12px; border-bottom:1px solid #1f2937; color:#fbbf24; background:#2a1a00; display:none; }
    #api-watchdog-list { overflow:auto; max-height:calc(78vh - 260px); padding:8px; }
    .api-watchdog-item { border:1px solid #1f2937; border-radius:8px; padding:8px; margin-bottom:8px; background:#111827; }
    .api-watchdog-item .line1 { font-weight:700; color:#f9fafb; margin-bottom:6px; word-break:break-all; }
    .api-watchdog-meta-row { margin-bottom:4px; color:#cbd5e1; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .api-watchdog-label { color:#94a3b8; font-weight:600; }
    .api-watchdog-status { font-weight:700; border-radius:999px; padding:2px 8px; font-size:11px; }
    .status-ok { background:#14532d; color:#dcfce7; }
    .status-info { background:#1e3a8a; color:#dbeafe; }
    .status-warn { background:#7c2d12; color:#ffedd5; }
    .status-error { background:#7f1d1d; color:#fee2e2; }
    .api-watchdog-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
    .api-watchdog-empty { color:#94a3b8; text-align:center; padding:20px; }
    #api-watchdog-toast { position:fixed; right:16px; bottom:24px; z-index:2147483647; background:#052e16; color:#dcfce7; border:1px solid #16a34a; border-radius:8px; padding:8px 10px; font:12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; opacity:0; pointer-events:none; transform:translateY(4px); transition:opacity .18s ease, transform .18s ease; }
    #api-watchdog-toast.show { opacity:1; transform:translateY(0); }
  `;
  document.documentElement.appendChild(style);

  const badge = document.createElement("div");
  badge.id = "api-watchdog-badge";
  badge.textContent = "🛡 API OFF";
  document.documentElement.appendChild(badge);

  const panel = document.createElement("div");
  panel.id = "api-watchdog-panel";
  panel.innerHTML = `
    <div id="api-watchdog-header">API WATCHDOG <span id="api-watchdog-close" style="cursor:pointer;opacity:.8">✕</span></div>
    <div id="api-watchdog-security">
      <button id="aw-toggle-host" class="api-watchdog-btn">Enable on this host</button>
      <button id="aw-toggle-deep" class="api-watchdog-btn">Deep Capture OFF</button>
      <button id="aw-toggle-prod" class="api-watchdog-btn warn" style="display:none">Allow Deep on PROD</button>
      <button id="aw-clear" class="api-watchdog-btn">Clear</button>
    </div>
    <div id="api-watchdog-pages">
      <span class="api-watchdog-label">Page:</span>
      <select id="aw-page-select"><option value="all">All Pages</option></select>
      <button id="aw-export" class="api-watchdog-btn">Export Issues CSV</button>
    </div>
    <div id="api-watchdog-alert"></div>
    <div id="api-watchdog-filters">
      <button class="api-watchdog-filter active" data-filter="all">All</button>
      <button class="api-watchdog-filter" data-filter="failed">Failed</button>
      <button class="api-watchdog-filter" data-filter="slow">Slow</button>
      <button class="api-watchdog-filter" data-filter="duplicate">Duplicate</button>
    </div>
    <div id="api-watchdog-list"></div>
  `;
  document.documentElement.appendChild(panel);

  const toast = document.createElement("div");
  toast.id = "api-watchdog-toast";
  document.documentElement.appendChild(toast);

  const list = panel.querySelector("#api-watchdog-list");
  const alertEl = panel.querySelector("#api-watchdog-alert");
  const hostBtn = panel.querySelector("#aw-toggle-host");
  const deepBtn = panel.querySelector("#aw-toggle-deep");
  const prodBtn = panel.querySelector("#aw-toggle-prod");
  const pageSelect = panel.querySelector("#aw-page-select");
  const exportBtn = panel.querySelector("#aw-export");

  let toastTimer = null;
  let routeDebounce = null;

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
  };

  const flashCopyButton = (btn, label = "Copied ✓") => {
    const prev = btn.textContent || "";
    btn.classList.add("copy-ok");
    btn.textContent = label;
    setTimeout(() => {
      btn.classList.remove("copy-ok");
      btn.textContent = prev;
    }, 900);
  };

  const renderPageOptions = () => {
    const existing = state.selectedPageId;
    const options = [`<option value="all">All Pages</option>`];

    for (const page of state.pages) {
      const label = `${page.path || page.url || "unknown"} • ${new Date(page.startedAt || Date.now()).toLocaleTimeString()}`;
      options.push(`<option value="${escaped(page.pageId)}">${escaped(label)}</option>`);
    }

    pageSelect.innerHTML = options.join("");
    if (existing && (existing === "all" || state.pages.some((p) => p.pageId === existing))) {
      pageSelect.value = existing;
    } else {
      state.selectedPageId = "all";
      pageSelect.value = "all";
    }
  };

  const render = () => {
    panel.style.display = state.panelOpen ? "block" : "none";

    if (!state.enabled) {
      badge.textContent = "🛡 API OFF";
      badge.style.background = "#374151";
    } else {
      const count = getIssueCount();
      badge.textContent = `${count > 0 ? "🔴" : "🟢"} API ${count}`;
      badge.style.background = "#111827";
    }

    hostBtn.textContent = state.enabled ? "Disable on this host" : "Enable on this host";
    hostBtn.classList.toggle("active", state.enabled);

    const deepActive = state.deepCapture && (!state.isProdLikeHost || state.prodOverride);
    deepBtn.textContent = deepActive ? "Deep Capture ON" : "Deep Capture OFF";
    deepBtn.classList.toggle("active", deepActive);

    prodBtn.style.display = state.isProdLikeHost ? "inline-block" : "none";
    prodBtn.textContent = state.prodOverride ? "PROD Deep Allowed" : "Allow Deep on PROD";
    prodBtn.classList.toggle("active", state.prodOverride);

    if (state.isProdLikeHost && state.enabled) {
      alertEl.style.display = "block";
      alertEl.textContent = deepActive
        ? "Production-like host: Deep capture is enabled by explicit override."
        : "Production-like host: Metadata-only capture active (recommended).";
    } else {
      alertEl.style.display = "none";
      alertEl.textContent = "";
    }

    renderPageOptions();

    exportBtn.style.opacity = state.filter === "all" ? "1" : "0.55";
    exportBtn.title = state.filter === "all" ? "Export failed/slow/duplicate issues" : "Switch to All filter to export";

    const rows = getRows();
    if (!state.enabled) {
      list.innerHTML = `<div class="api-watchdog-empty">Monitoring disabled for this host/tab. Click <b>Enable on this host</b>.</div>`;
      return;
    }
    if (!rows.length) {
      list.innerHTML = `<div class="api-watchdog-empty">No entries for this page/filter.</div>`;
      return;
    }

    list.innerHTML = rows.map((e) => {
      const info = e.__info || { issueTypes: [], duplicateCount: 0 };
      const issueText = info.issueTypes.length ? info.issueTypes.join(", ") : "NONE";

      return `
        <div class="api-watchdog-item" data-id="${e.id}">
          <div class="line1">${escaped(e.method)} ${escaped(e.url)}</div>
          <div class="api-watchdog-meta-row"><span class="api-watchdog-label">Status:</span><span class="api-watchdog-status ${statusClass(e.status)}">${escaped(String(e.status))}</span></div>
          <div class="api-watchdog-meta-row"><span class="api-watchdog-label">Duration:</span><span>${escaped(formatMs(e.durationMs))}${info.slow ? " (SLOW)" : ""}</span></div>
          <div class="api-watchdog-meta-row"><span class="api-watchdog-label">Issue:</span><span>${escaped(issueText)}</span></div>
          <div class="api-watchdog-meta-row"><span class="api-watchdog-label">Page:</span><span>${escaped(pageLabel(e.pageId))}</span></div>
          ${info.duplicate ? `<div class="api-watchdog-meta-row"><span class="api-watchdog-label">Duplicate Count:</span><span>${info.duplicateCount}</span></div>` : ""}
          <div class="api-watchdog-actions">
            <button class="api-watchdog-btn" data-action="curl" data-id="${e.id}">Copy cURL</button>
            <button class="api-watchdog-btn" data-action="request" data-id="${e.id}">Copy Request</button>
            <button class="api-watchdog-btn" data-action="response" data-id="${e.id}">Copy Response</button>
          </div>
        </div>
      `;
    }).join("");
  };

  const processIncomingRaw = (raw) => {
    if (!raw || typeof raw !== "object") return;
    if (!raw.url || typeof raw.method !== "string") return;
    if (!state.enabled) return;

    const event = {
      id: randomId(),
      pageId: state.currentPageId || "unknown",
      timestamp: raw.timestamp || new Date().toISOString(),
      method: String(raw.method || "GET").toUpperCase(),
      url: String(raw.url),
      status: Number(raw.status || 0),
      durationMs: Number(raw.durationMs || 0),
      key: `${String(raw.method || "GET").toUpperCase()} ${normalizeUrl(raw.url)}`,
      transport: raw.transport || "",
      networkError: Boolean(raw.networkError),
      requestHeaders: redactHeaders(raw.requestHeaders),
      requestBody: redactBodyText(raw.requestBody),
      responseHeaders: redactHeaders(raw.responseHeaders),
      responseBody: redactBodyText(raw.responseBody)
    };

    state.events.unshift(event);
    if (state.events.length > MAX_EVENTS) state.events.pop();

    runtimeMsg({ type: "aw:recordEvent", event });
    render();
  };

  const setupSpaPageTracking = () => {
    const create = () => {
      if (routeDebounce) clearTimeout(routeDebounce);
      routeDebounce = setTimeout(() => {
        createPageSession();
      }, 120);
    };

    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function patchedPushState() {
      const out = origPush.apply(this, arguments);
      create();
      return out;
    };

    history.replaceState = function patchedReplaceState() {
      const out = origReplace.apply(this, arguments);
      create();
      return out;
    };

    window.addEventListener("popstate", create);
    window.addEventListener("hashchange", create);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.channel !== EVENT_CHANNEL) return;

    const raw = event.data.payload;
    if (!state.initialized) {
      if (pendingRawEvents.length < MAX_EVENTS) pendingRawEvents.push(raw);
      return;
    }

    processIncomingRaw(raw);
  });

  badge.addEventListener("click", () => {
    state.panelOpen = !state.panelOpen;
    runtimeMsg({ type: "aw:setPanelOpen", panelOpen: state.panelOpen });
    render();
  });

  panel.querySelector("#api-watchdog-close").addEventListener("click", () => {
    state.panelOpen = false;
    runtimeMsg({ type: "aw:setPanelOpen", panelOpen: false });
    render();
  });

  hostBtn.addEventListener("click", async () => {
    state.enabled = !state.enabled;
    await saveHostFlag("awAllowedHosts", state.enabled);
    await runtimeMsg({ type: "aw:setTabEnabled", enabled: state.enabled });
    if (!state.enabled) {
      state.events = [];
      state.pages = [];
      state.selectedPageId = "all";
      await runtimeMsg({ type: "aw:clearTabData" });
      await createPageSession();
    }
    setConfigToInjected();
    render();
  });

  deepBtn.addEventListener("click", async () => {
    state.deepCapture = !state.deepCapture;
    await saveHostFlag("awDeepCaptureHosts", state.deepCapture);
    setConfigToInjected();
    render();
  });

  prodBtn.addEventListener("click", async () => {
    state.prodOverride = !state.prodOverride;
    await saveHostFlag("awProdOverrides", state.prodOverride);
    setConfigToInjected();
    render();
  });

  panel.querySelector("#aw-clear").addEventListener("click", async () => {
    state.events = [];
    state.pages = [];
    state.selectedPageId = "all";
    await runtimeMsg({ type: "aw:clearTabData" });
    await createPageSession();
    render();
  });

  pageSelect.addEventListener("change", () => {
    state.selectedPageId = pageSelect.value || "all";
    render();
  });

  exportBtn.addEventListener("click", () => {
    if (state.filter !== "all") {
      showToast("Switch to All filter to export issues");
      return;
    }

    const rows = buildIssueExportRows();
    if (!rows.length) {
      showToast("No failed/slow/duplicate APIs to export");
      return;
    }

    const csv = toCsv(rows);
    const stamp = new Date().toISOString().replace(/[.:]/g, "-");
    downloadCsv(`api-watchdog-issues-${stamp}.csv`, csv);
    showToast(`Exported ${rows.length} issue rows`);
  });

  panel.querySelectorAll(".api-watchdog-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      panel.querySelectorAll(".api-watchdog-filter").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
  });

  list.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionBtn = target.closest("button[data-action]");
    if (!(actionBtn instanceof HTMLElement)) return;

    const action = actionBtn.getAttribute("data-action");
    const id = actionBtn.getAttribute("data-id");
    if (!action || !id) return;

    const entry = state.events.find((e) => e.id === id);
    if (!entry) return;

    if (action === "curl") {
      await copyText(toCurl(entry));
      flashCopyButton(actionBtn);
      showToast("cURL copied");
      return;
    }

    if (action === "request") {
      await copyText(JSON.stringify({
        method: entry.method,
        url: entry.url,
        headers: Object.fromEntries(entry.requestHeaders || []),
        body: entry.requestBody ?? "[NOT_CAPTURED]"
      }, null, 2));
      flashCopyButton(actionBtn);
      showToast("Request copied");
      return;
    }

    if (action === "response") {
      await copyText(JSON.stringify({
        status: entry.status,
        headers: Object.fromEntries(entry.responseHeaders || []),
        body: entry.responseBody ?? "[NOT_CAPTURED]"
      }, null, 2));
      flashCopyButton(actionBtn);
      showToast("Response copied");
    }
  });
  
    /*
   * =====================================================
   * QA TOOLKIT LAUNCHER SUPPORT
   * =====================================================
   */

  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

      if (message?.type !== "aw:openPanel") {
        return;
      }

      try {

        // Enable API Watchdog
        state.enabled = true;

        // Open API Watchdog panel
        state.panelOpen = true;


        // Update tab state in background
        runtimeMsg({
          type: "aw:setTabEnabled",
          enabled: true
        });


        runtimeMsg({
          type: "aw:setPanelOpen",
          panelOpen: true
        });


        // Inform injected API monitoring script
        setConfigToInjected();


        // Refresh Watchdog UI
        render();


        sendResponse({
          ok: true
        });

      }
      catch (error) {

        console.error(
          "API Watchdog open failed:",
          error
        );


        sendResponse({
          ok: false,
          error: error.message
        });

      }

    }
  );

  (async () => {
    await hydrateFromTabSession();
    await loadSettings();

    await createPageSession();
    setupSpaPageTracking();

    setConfigToInjected();
    state.initialized = true;

    if (pendingRawEvents.length) {
      const queue = pendingRawEvents.splice(0, pendingRawEvents.length);
      for (const raw of queue) processIncomingRaw(raw);
    }

    render();
  })();
})();