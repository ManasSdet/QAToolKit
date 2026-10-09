(() => {
  if (window.__API_WATCHDOG_INJECTED__) return;
  window.__API_WATCHDOG_INJECTED__ = true;

  const EVENT_CHANNEL = "__API_WATCHDOG_EVENT__";
  const CONFIG_CHANNEL = "__API_WATCHDOG_CONFIG__";
  const SENSITIVE_HEADERS = new Set([
    "authorization", "cookie", "set-cookie", "x-api-key", "x-auth-token", "proxy-authorization"
  ]);

  const config = {
    enabled: false,
    deepCapture: false,
    maxBodyChars: 4000
  };
  let configReceived = false;
  const pendingEvents = [];
  const MAX_PENDING_EVENTS = 100;

  const truncate = (text, maxLen) => {
    if (typeof text !== "string") return text;
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}\n...[TRUNCATED ${text.length - maxLen} chars]`;
  };

  const redactTokenLike = (value) => String(value)
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]");

  const redactHeader = (name, value) => {
    const key = String(name || "").toLowerCase();
    if (SENSITIVE_HEADERS.has(key) || key.includes("token") || key.includes("secret") || key.includes("key")) {
      return "[REDACTED]";
    }
    return redactTokenLike(String(value || ""));
  };

  const sanitizeUrl = (url, deepCapture) => {
    try {
      const u = new URL(String(url), location.href);
      if (!deepCapture) return `${u.origin}${u.pathname}`;
      for (const key of [...u.searchParams.keys()]) {
        const k = key.toLowerCase();
        if (k.includes("token") || k.includes("secret") || k.includes("key") || k.includes("pass") || k.includes("auth")) {
          u.searchParams.set(key, "[REDACTED]");
        }
      }
      u.hash = "";
      return `${u.origin}${u.pathname}${u.search}`;
    } catch {
      return String(url || "").split("#")[0];
    }
  };

  const normalizeHeaders = (headers) => {
    if (!headers) return [];
    try {
      if (headers instanceof Headers) {
        return Array.from(headers.entries()).map(([k, v]) => [String(k), redactHeader(k, v)]);
      }
      if (Array.isArray(headers)) {
        return headers.map(([k, v]) => [String(k), redactHeader(k, v)]);
      }
      return Object.entries(headers).map(([k, v]) => [String(k), redactHeader(k, v)]);
    } catch {
      return [];
    }
  };

  const safeBody = (body) => {
    if (!config.deepCapture) return null;
    if (body == null) return null;

    let text;
    if (typeof body === "string") text = body;
    else if (body instanceof URLSearchParams) text = body.toString();
    else if (body instanceof FormData) {
      try {
        text = JSON.stringify(Array.from(body.entries()));
      } catch {
        text = "[FormData]";
      }
    } else if (body instanceof Blob) text = `[Blob ${body.type || "application/octet-stream"}]`;
    else if (body instanceof ArrayBuffer) text = `[ArrayBuffer ${body.byteLength}]`;
    else if (ArrayBuffer.isView(body)) text = `[TypedArray ${body.byteLength}]`;
    else {
      try {
        text = JSON.stringify(body);
      } catch {
        text = String(body);
      }
    }

    return truncate(redactTokenLike(text), config.maxBodyChars);
  };

  const post = (payload) => {
    window.postMessage({ channel: EVENT_CHANNEL, payload }, "*");
  };

  const emit = (payload) => {
    if (configReceived) {
      if (config.enabled) post(payload);
      return;
    }

    pendingEvents.push(payload);
    if (pendingEvents.length > MAX_PENDING_EVENTS) pendingEvents.shift();
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.channel !== CONFIG_CHANNEL) return;
    const incoming = event.data.payload || {};

    config.enabled = Boolean(incoming.enabled);
    config.deepCapture = Boolean(incoming.deepCapture);

    const maxBody = Number(incoming.maxBodyChars);
    if (Number.isFinite(maxBody) && maxBody >= 256 && maxBody <= 20000) {
      config.maxBodyChars = Math.floor(maxBody);
    }

    const wasPending = !configReceived;
    configReceived = true;
    if (wasPending) {
      if (config.enabled) {
        for (const eventPayload of pendingEvents) post(eventPayload);
      }
      pendingEvents.length = 0;
    }
  });

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function watchdogFetch(input, init = {}) {
      const monitorThisCall = configReceived ? config.enabled : true;
      const captureBody = configReceived ? config.deepCapture : false;

      if (!monitorThisCall) {
        return originalFetch.apply(this, arguments);
      }

      const start = performance.now();
      const request = input instanceof Request ? input : null;
      const method = (init.method || request?.method || "GET").toUpperCase();
      const url = sanitizeUrl(request?.url || String(input), captureBody);
      const requestHeaders = normalizeHeaders(init.headers || request?.headers);

      let requestBody = captureBody ? safeBody(init.body) : null;
      if (requestBody == null && captureBody && request) {
        try {
          requestBody = truncate(redactTokenLike(await request.clone().text()), config.maxBodyChars);
        } catch {
          requestBody = null;
        }
      }

      try {
        const response = await originalFetch.apply(this, arguments);
        const durationMs = Math.round(performance.now() - start);

        let responseBody = null;
        if (captureBody) {
          try {
            responseBody = truncate(redactTokenLike(await response.clone().text()), config.maxBodyChars);
          } catch {
            responseBody = "[unreadable response body]";
          }
        }

        emit({
          transport: "fetch",
          method,
          url,
          status: response.status,
          durationMs,
          requestHeaders,
          requestBody,
          responseHeaders: normalizeHeaders(response.headers),
          responseBody,
          ok: response.ok,
          timestamp: new Date().toISOString()
        });

        return response;
      } catch (error) {
        const durationMs = Math.round(performance.now() - start);
        emit({
          transport: "fetch",
          method,
          url,
          status: 0,
          durationMs,
          requestHeaders,
          requestBody,
          responseHeaders: [],
          responseBody: String(error),
          ok: false,
          timestamp: new Date().toISOString(),
          networkError: true
        });
        throw error;
      }
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function watchdogOpen(method, url) {
    this.__watchdog = {
      method: String(method || "GET").toUpperCase(),
      url: String(url || ""),
      start: 0,
      requestHeaders: [],
      requestBody: null,
      enabledAtSend: false
    };
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function watchdogSetRequestHeader(name, value) {
    if (this.__watchdog) {
      this.__watchdog.requestHeaders.push([String(name), redactHeader(name, value)]);
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function watchdogSend(body) {
    if (this.__watchdog) {
      this.__watchdog.start = performance.now();
      this.__watchdog.requestBody = safeBody(body);
      this.__watchdog.enabledAtSend = configReceived ? config.enabled : true;
      this.__watchdog.deepCaptureAtSend = configReceived ? config.deepCapture : false;
      this.__watchdog.url = sanitizeUrl(this.__watchdog.url, this.__watchdog.deepCaptureAtSend);
    }

    this.addEventListener("loadend", () => {
      const ctx = this.__watchdog || {};
      if (!ctx.enabledAtSend) return;

      const durationMs = ctx.start ? Math.round(performance.now() - ctx.start) : 0;
      const headersRaw = this.getAllResponseHeaders() || "";
      const responseHeaders = headersRaw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(":");
          if (idx === -1) return [line.trim(), ""];
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          return [key, redactHeader(key, value)];
        });

      let responseBody = null;
      if (ctx.deepCaptureAtSend) {
        responseBody = typeof this.responseText === "string"
          ? truncate(redactTokenLike(this.responseText), config.maxBodyChars)
          : "[non-text response]";
      }

      emit({
        transport: "xhr",
        method: ctx.method || "GET",
        url: ctx.url || "",
        status: this.status,
        durationMs,
        requestHeaders: ctx.requestHeaders || [],
        requestBody: ctx.requestBody || null,
        responseHeaders,
        responseBody,
        ok: this.status >= 200 && this.status < 400,
        timestamp: new Date().toISOString(),
        networkError: this.status === 0
      });
    });

    return originalSend.apply(this, arguments);
  };
})();
