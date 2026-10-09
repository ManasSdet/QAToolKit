const MAX_EVENTS = 600;
const MAX_PAGES = 80;

const storageArea = chrome.storage.session || chrome.storage.local;
const keyForTab = (tabId) => `awTab_${tabId}`;

const defaultData = () => ({
  enabled: false,
  panelOpen: false,
  events: [],
  pages: []
});

const readTabData = async (tabId) => {
  const key = keyForTab(tabId);
  try {
    const stored = await storageArea.get([key]);
    const value = stored[key];
    if (value && typeof value === "object") {
      return {
        enabled: Boolean(value.enabled),
        panelOpen: Boolean(value.panelOpen),
        events: Array.isArray(value.events) ? value.events.slice(0, MAX_EVENTS) : [],
        pages: Array.isArray(value.pages) ? value.pages.slice(0, MAX_PAGES) : []
      };
    }
  } catch {
    // ignore
  }
  return defaultData();
};

const writeTabData = async (tabId, data) => {
  const key = keyForTab(tabId);
  await storageArea.set({ [key]: data });
};

const removeTabData = async (tabId) => {
  const key = keyForTab(tabId);
  await storageArea.remove([key]);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse(null);
    return false;
  }

  (async () => {
    try {
      if (message?.type === "aw:getTabSession") {
        sendResponse(await readTabData(tabId));
        return;
      }

      if (message?.type === "aw:setTabEnabled") {
        const data = await readTabData(tabId);
        data.enabled = Boolean(message.enabled);
        await writeTabData(tabId, data);
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "aw:setPanelOpen") {
        const data = await readTabData(tabId);
        data.panelOpen = Boolean(message.panelOpen);
        await writeTabData(tabId, data);
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "aw:upsertPage") {
        const page = message.page;
        if (!page || typeof page !== "object" || !page.pageId) {
          sendResponse({ ok: false });
          return;
        }

        const data = await readTabData(tabId);
        const pages = Array.isArray(data.pages) ? data.pages : [];
        const idx = pages.findIndex((p) => p.pageId === page.pageId);
        if (idx >= 0) pages[idx] = { ...pages[idx], ...page };
        else pages.unshift(page);

        data.pages = pages.slice(0, MAX_PAGES);
        await writeTabData(tabId, data);
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "aw:recordEvent") {
        const data = await readTabData(tabId);
        data.enabled = true;

        const event = message.event;
        if (event && typeof event === "object") {
          data.events = [event, ...(Array.isArray(data.events) ? data.events : [])].slice(0, MAX_EVENTS);
        }

        await writeTabData(tabId, data);
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "aw:clearTabData") {
        const existing = await readTabData(tabId);
        await writeTabData(tabId, {
          enabled: existing.enabled,
          panelOpen: existing.panelOpen,
          events: [],
          pages: []
        });
        sendResponse({ ok: true });
        return;
      }

      sendResponse(null);
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabData(tabId).catch(() => {});
});