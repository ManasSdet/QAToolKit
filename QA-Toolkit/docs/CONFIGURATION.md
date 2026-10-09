# QA Toolkit Configuration and Data Handling

QA Toolkit has no repository-level environment file or command-line configuration. It uses browser extension permissions, the current browser tab, and Chrome extension storage.

## Required extension permissions

The combined extension requests:

- `tabs` and `activeTab` to read the active page and open comparison/report tabs;
- `scripting` to collect comparison and capture data from pages;
- `storage` to retain extension state and comparison results;
- `downloads` to download Bug Evidence and API Watchdog files;
- host access to all URLs so its content scripts can run on HTTP and HTTPS pages.

Install the repository-root extension only in a Chrome profile where this level of page access is appropriate.

## EnvCompare input

EnvCompare does not use a checked-in URL list. It starts from the active tab.

- Select one of SIT, UAT, STAGE, or PROD.
- The extension generates a target URL from the source hostname when it recognises a supported pattern.
- Edit the **Target URL** field when automatic generation is not correct.

There is an `EnvCompare/options.html` settings page in the source tree that can save project and environment URL values to Chrome local storage. The current EnvCompare popup generates its comparison target from the current page and editable Target URL field; it does not read those saved values.

## Stored data

The tools use Chrome extension storage:

| Tool | Data stored by the implementation |
|---|---|
| EnvCompare | The latest `comparisonResult`, including source/target URLs and gathered comparison data, in `chrome.storage.local`. |
| API Watchdog | Host-level enable/deep-capture settings and per-tab monitoring data. It uses session storage when available and falls back to local storage. |
| Bug Evidence Collector | The collected report is assembled in the popup; download output is written through Chrome Downloads. |

EnvCompare stores one current comparison result under `comparisonResult`, so a new comparison replaces the previous stored report.

## API Watchdog capture modes

### Default metadata capture

After **Enable on this host** is selected, API Watchdog observes `fetch` and `XMLHttpRequest` calls. By default, request and response bodies are not captured. URLs are normalised to origin and path for monitoring.

### Deep Capture

**Deep Capture** can include request and response bodies and query strings, subject to the extension’s redaction and size limits.

For hosts the tool classifies as production-like, deep capture remains off unless the user also selects **Allow Deep on PROD**. The tool treats `localhost`, `127.0.0.1`, `::1`, and hosts ending in `.local`, `.test`, or `.internal` as non-production-like. It also treats names containing `dev`, `qa`, `test`, `staging`, `stage`, `uat`, or `sandbox` as non-production-like.

### Redaction implemented by API Watchdog

The API Watchdog code redacts sensitive request/response headers such as `Authorization`, `Cookie`, and header names containing token, secret, or key. It also redacts common bearer-token, JWT, and key/value patterns from captured text.

Redaction is a safeguard, not a guarantee that exported or copied information is safe to share. Review output before sharing it.

## Bug Evidence output

Bug Evidence Collector downloads to a folder named in this form:

```text
bug-evidence-YYYY-MM-DD-HHMMSS/
```

Depending on selected options and capture success, it contains:

```text
evidence.json
bug-report.txt
screenshot.png
```

`screenshot.png` is included only when the visible-tab screenshot is captured successfully.
