# API Watchdog (Chrome Extension - MV3)

API Watchdog overlays a lightweight in-page monitor so testers can detect API failures, slow calls, and duplicate requests without keeping DevTools open.

## Security-first behavior

- Host opt-in (default OFF)
- Metadata-only by default
- Deep capture explicit toggle
- Production-like deep-capture guardrail
- Secret redaction for sensitive headers/tokens

## New workflow features

- **Page-wise persistence:** logs are preserved as page sessions while users navigate.
- **Page selector:** view APIs by specific application page or across all pages.
- **Status highlighting:** explicit `Status` field with color-coded status badge.
- **Issues export:** in **All** filter, export failed/slow/duplicate API rows to CSV.

## Detection rules

- **Failed**: `status >= 400` or network error (`status = 0`)
- **Slow**: `duration >= 3000 ms`
- **Duplicate**: same method+path repeated within page scope

## Files

- `/manifest.json` – extension config
- `/background.js` – tab session persistence (pages + events)
- `/injected.js` – fetch/XHR instrumentation
- `/content.js` – UI + filters + page grouping + export

## Setup

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked folder: `C:\Users\manas\Documents\ChatGPT\API_Plugin`
4. Enable on target host from the panel

## Exported CSV columns

`exportedAt, pageId, pageTitle, pagePath, pageUrl, timestamp, method, apiUrl, statusCode, durationMs, issueType, duplicateCount, transport, networkError`