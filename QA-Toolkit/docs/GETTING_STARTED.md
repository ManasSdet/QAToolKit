# QA Toolkit: Getting Started

QA Toolkit is a **Chrome extension** containing three browser-based utilities:

1. **EnvCompare** — compares a page between two environments.
2. **Bug Evidence Collector** — collects evidence from the current page for a bug report.
3. **API Watchdog** — monitors failed, slow, and duplicate API calls on the current host.

It is not a test-automation project and does not require Python, a test runner, page objects, or environment configuration files.

## Install the extension

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Select the repository root: the folder containing `manifest.json`, `background.js`, and the `launcher` folder.
5. Pin **QA Toolkit** to the Chrome toolbar if you want quick access.

When source files are changed, select **Reload** for the QA Toolkit extension on `chrome://extensions`, then refresh the website tab before using a tool.

## Open a tool

1. Open the HTTP or HTTPS page you want to inspect.
2. Select the QA Toolkit extension icon.
3. Select one of the three tools.

The launcher requires an active website tab. It will not start these tools from Chrome internal pages such as `chrome://extensions`.

## Use EnvCompare

1. Open the source page.
2. In QA Toolkit, choose **EnvCompare**.
3. Choose the target environment: **SIT**, **UAT**, **STAGE**, or **PROD**.
4. Review the generated target URL. You can edit it before starting the comparison.
5. Select **Compare Pages**.
6. QA Toolkit opens the target URL in a background tab and then opens an Environment Comparison Report.

The report includes functional differences, detailed UI differences, environment health checks, visual component comparison, and console-error comparison. See [Project Guide](PROJECT_GUIDE.md#envcompare) for scope and limitations.

## Use Bug Evidence Collector

1. Navigate to the page where the issue is visible.
2. In QA Toolkit, choose **Bug Evidence Collector**.
3. Enter an **Issue Summary** and **Action Performed**.
4. Keep or clear the evidence checkboxes as needed:
   - Page Details
   - Browser Information
   - Screenshot
   - Console Errors
   - Failed API Requests
5. Select **Collect Evidence**.
6. Review the collected information, then either:
   - select **Copy for Jira**, or
   - select **Download Evidence Report**.

The downloaded package contains `evidence.json`, `bug-report.txt`, and, when captured, `screenshot.png`.

## Use API Watchdog

1. Open the page to monitor.
2. In QA Toolkit, choose **API Watchdog**.
3. In the in-page panel, select **Enable on this host**.
4. Perform the user journey that you want to observe.
5. Use the filters to inspect all, failed, slow, or duplicate API calls.
6. Select **Export Issues** while the **All** filter is active to download issue rows as CSV.

API Watchdog observes browser `fetch` and `XMLHttpRequest` calls. Monitoring is disabled by default for each host.

## Before sharing captured output

URLs, screenshots, console messages, and request metadata may contain application or user information. Review downloaded files and copied text before sharing them.

For tool details and project structure, read [Project Guide](PROJECT_GUIDE.md). For Chrome storage and capture behavior, read [Configuration](CONFIGURATION.md).
