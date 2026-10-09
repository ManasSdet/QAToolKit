# QA Toolkit Technical Stack and Architecture

## Architecture document status

The existing [Project Guide](PROJECT_GUIDE.md) explains the repository structure and the three tools, but it is not a dedicated architecture document. This file provides the technical-stack and runtime-architecture view of the application.

## Application type

QA Toolkit is a **Google Chrome extension** built with **Manifest V3**.

The repository-root `manifest.json` defines a combined extension that exposes one toolbar launcher and bundles three browser-based QA tools:

- **EnvCompare**
- **Bug Evidence Collector**
- **API Watchdog**

There is no server-side application, package manager configuration, transpilation configuration, or frontend framework in this repository. The source is browser-native HTML, CSS, and JavaScript.

## Technology stack

| Layer | Technology used | Where it is used |
|---|---|---|
| Extension platform | Chrome Extensions, Manifest V3 | Root `manifest.json` and the tool manifests |
| Programming language | Plain JavaScript (ES features supported by Chrome) | All `.js` files |
| User interface | HTML | Launcher, popups, EnvCompare report |
| Styling | Plain CSS | Launcher, EnvCompare, and Bug Evidence Collector |
| Background execution | Chrome extension service workers | Root `background.js`, `EnvCompare/background.js`, `API_Plugin/background.js` |
| Web-page integration | Content scripts in isolated and main execution worlds | EnvCompare console capture, Bug Evidence collection, API Watchdog monitoring |
| Browser APIs | `chrome.tabs`, `chrome.runtime`, `chrome.storage`, `chrome.downloads`, `chrome.scripting` | Extension workflows, state, capture, and downloads |
| Client-side data capture | Browser DOM APIs, `fetch`, `XMLHttpRequest`, History API | Page comparison and API monitoring |
| Visual comparison | Browser screenshots, Canvas/image processing, DOM component discovery | `EnvCompare/visualCapture.js`, `EnvCompare/visual.js` |
| Data exchange | Chrome runtime messages and browser `window.postMessage` | Communication between popup, content script, page, and service worker |

## Runtime architecture

```text
Chrome toolbar
    │
    ▼
QA Toolkit launcher
    │
    ├── EnvCompare
    ├── Bug Evidence Collector
    └── API Watchdog

Each tool communicates with:
    • the active browser tab;
    • Chrome extension service-worker logic;
    • Chrome extension storage; and/or
    • Chrome Downloads for exported files.
```

### Combined-extension entry points

| File | Responsibility |
|---|---|
| `manifest.json` | Registers the QA Toolkit extension, permissions, toolbar popup, background service worker, content scripts, and accessible API Watchdog script. |
| `launcher/launcher.html` | Toolbar popup shown when the QA Toolkit icon is selected. |
| `launcher/launcher.js` | Opens EnvCompare or Bug Evidence Collector within the extension popup, or sends a message to open API Watchdog in the active page. |
| `background.js` | Imports the EnvCompare visual/console/background scripts and API Watchdog background script into the combined service worker. |

## Execution contexts

Chrome extensions separate code into different execution contexts. QA Toolkit uses all of the following.

| Context | Purpose in QA Toolkit |
|---|---|
| Extension popup | Provides the launcher, Bug Evidence interface, and EnvCompare start interface. |
| Extension service worker | Coordinates comparisons, tab operations, persisted state, and API Watchdog tab sessions. |
| Isolated-world content script | Communicates safely with extension APIs while running alongside a web page. |
| Main-world content script | Hooks browser/page APIs such as `console.error`, `fetch`, and `XMLHttpRequest`, which need access to the page’s JavaScript environment. |
| Extension report tab | Renders the EnvCompare report using the result stored in Chrome local storage. |
| In-page overlay | Renders the API Watchdog badge and panel directly in the inspected web page. |

## Tool architecture

### EnvCompare

```text
Source website tab
    │
    │ select target environment / edit target URL
    ▼
EnvCompare popup
    │ chrome.runtime message
    ▼
EnvCompare background logic
    ├── extracts source-page data
    ├── opens and loads target tab
    ├── extracts target-page data
    ├── runs functional and health comparisons
    ├── captures visual components
    └── captures and compares console errors
    │
    ▼
chrome.storage.local: comparisonResult
    │
    ▼
EnvCompare report tab
```

EnvCompare uses the active source page and an HTTP/HTTPS target URL. It compares page data, visible page elements, health resources, component screenshots, and captured console errors.

### Bug Evidence Collector

```text
Website page monitor (main world)
    │ window.postMessage
    ▼
Extension bridge (isolated world)
    │ chrome.runtime message
    ▼
Bug Evidence popup
    ├── collects selected page/browser details
    ├── captures the visible browser tab
    ├── displays gathered evidence
    ├── copies Jira-formatted text
    └── downloads evidence files
```

The main-world monitor observes console errors, uncaught errors, unhandled promise rejections, and failed `fetch`/`XMLHttpRequest` calls. The isolated-world bridge retains the captured console and API failure entries for the popup.

### API Watchdog

```text
API Watchdog injected script (main world)
    │ instruments fetch and XMLHttpRequest
    │ window.postMessage
    ▼
API Watchdog content script (isolated world)
    ├── renders in-page badge and panel
    ├── classifies API events
    └── sends tab-session messages
    │
    ▼
API Watchdog background service-worker logic
    │
    ▼
chrome.storage.session
    └── falls back to chrome.storage.local when session storage is unavailable
```

API Watchdog is host-opt-in. It adds an in-page panel and monitors request metadata by default. Deep capture is a separate control for bodies and query strings.

## Browser APIs in use

| API | Usage |
|---|---|
| `chrome.tabs` | Reads active tabs, opens target/report tabs, captures visible tabs, and tracks tab lifecycle. |
| `chrome.runtime` | Sends messages between the launcher, popup, content scripts, and background logic. |
| `chrome.storage.local` | Stores the latest EnvCompare result and persistent API Watchdog host settings. |
| `chrome.storage.session` | Stores API Watchdog per-tab state where available. |
| `chrome.downloads` | Downloads Bug Evidence packages. |
| `chrome.scripting` | Declared for extension page interaction and script-based operations. |
| `window.postMessage` | Bridges page-world interception code to isolated-world extension code. |

## Data flow and persistence

| Feature | Data flow | Persistence |
|---|---|---|
| EnvCompare | Source and target pages → background comparison → report | Latest result in `chrome.storage.local` |
| Bug Evidence | Page monitor → isolated bridge → popup → clipboard/download | In-memory collected evidence until exported |
| API Watchdog | Page API interception → in-page UI → background tab session | Session storage when available; local-storage fallback |

## Build and dependency model

The repository does not contain a dependency manifest or build configuration. The extension is loaded directly as an unpacked Chrome extension, and Chrome executes the source JavaScript, HTML, and CSS files as provided.

This means changes do not require a compile step. To test a source change:

1. Reload QA Toolkit from `chrome://extensions`.
2. Refresh the target website tab so updated content scripts are installed.
3. Reopen the relevant QA Toolkit tool.
