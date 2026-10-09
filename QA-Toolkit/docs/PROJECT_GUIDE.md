# Project Guide

## Project structure

The root `manifest.json` defines the combined **QA Toolkit** Chrome Manifest V3 extension. Its toolbar popup is `launcher/launcher.html`; the launcher opens the three bundled tools.

| Location | Purpose |
|---|---|
| `manifest.json` | Combined QA Toolkit extension manifest. |
| `background.js` | Root service worker that loads EnvCompare and API Watchdog background logic. |
| `launcher/` | Toolbar launcher for the three tools. |
| `EnvCompare/` | Environment comparison tool, report, background processing, and capture scripts. |
| `Bug-Evidence-Collector/` | Bug-evidence popup and page-monitoring scripts. |
| `API_Plugin/` | API Watchdog in-page monitor, UI, and session handling. |
| `icons/` | Icons used by the combined extension. |

Each tool folder also contains a standalone manifest. The repository-root manifest is the one that combines them into QA Toolkit.

## EnvCompare

EnvCompare starts from the active source page and compares it with a target URL.

### Environment detection and target URL

It detects **SIT**, **UAT**, **STAGE**, and **PROD** from common hostname patterns, including environment subdomains and names containing `-sit`, `-uat`, `-stage`, or `-prod`. A hostname beginning with `www.` is treated as PROD.

EnvCompare attempts to generate a target URL while preserving the source page path, query string, hash, port, and protocol. The target URL field is editable, so use it when the automatic hostname transformation does not match the application’s URL scheme.

### Comparison report

EnvCompare opens the target page in another tab, gathers information from both pages, stores the result in Chrome local storage, and opens `EnvCompare/compare.html`.

The report presents:

- **Functional comparison:** page structure and visible content, including links, buttons, headings, form fields, forms, and navigation.
- **Detailed differences:** items missing from or additional in the target page.
- **Environment health:** checks of visible same-origin links, image resources, and font families/files.
- **Visual component comparison:** component-level screenshots and similarity results.
- **Console error comparison:** captured `console.error`, JavaScript errors, and unhandled promise rejections from the source and target pages.

Health checks are intentionally limited by the implementation to avoid excessive requests: up to 50 links and 50 images per page are checked, with a 10-second request timeout and up to six concurrent checks.

### Important limitations

- The report compares the pages as loaded at comparison time; it does not execute a business workflow in either environment.
- A target page that needs authentication, has different access controls, or does not finish loading can produce incomplete or failed comparisons.
- Link health validation is limited to visible same-origin links.
- Visual comparison uses screenshots of discovered visible components; it is not a full-page pixel-perfect comparison.

## Bug Evidence Collector

Bug Evidence Collector collects evidence from the current page through its popup.

### Available evidence

The user can choose to collect:

- issue summary and action performed;
- page title and URL;
- browser information;
- a screenshot of the visible tab;
- captured console errors;
- failed API requests.

The page monitor captures `console.error`, uncaught JavaScript errors, and unhandled promise rejections. It also observes `fetch` and `XMLHttpRequest` calls and records failed requests, including network errors. Requests to a built-in list of analytics and monitoring domains are ignored.

### Output

The tool displays the collected evidence in the popup. It can:

- copy formatted evidence for Jira to the clipboard; and
- download an evidence package named `bug-evidence-YYYY-MM-DD-HHMMSS`.

The downloaded package includes `evidence.json` and `bug-report.txt`; it also includes `screenshot.png` when screenshot capture succeeded.

## API Watchdog

API Watchdog adds an in-page monitoring panel after it is launched from QA Toolkit.

### Detection rules

It categorises an API call as:

- **Failed** when the HTTP status is 400 or higher, or when the request has a network error (status 0).
- **Slow** when its duration is at least 3,000 ms.
- **Duplicate** when the same HTTP method and normalised path occur more than once within the same page session.

The panel can show events for all page sessions in the tab or one selected page session. It provides all, failed, slow, and duplicate filters.

### Exports and copies

With the **All** filter selected, **Export Issues** downloads CSV rows for failed, slow, and duplicate events. An event row can also copy a cURL command, request details, or response details.

### Capture controls

API Watchdog is disabled until the user enables it for the current host. It captures request metadata by default. **Deep Capture** is a separate control for request and response content; production-like hosts require an additional explicit override before deep capture is active.
