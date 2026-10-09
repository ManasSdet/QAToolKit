# Troubleshooting

## QA Toolkit is not listed or will not load

1. Open `chrome://extensions`.
2. Confirm that **Developer mode** is enabled.
3. Confirm that QA Toolkit was loaded from the repository root, not from `EnvCompare`, `Bug-Evidence-Collector`, or `API_Plugin`.
4. Select **Reload** on the QA Toolkit extension card.
5. Review the extension card for manifest or service-worker errors.

The root folder must contain the combined `manifest.json`.

## A tool says that no active website is available

The launcher only starts tools from an `http://` or `https://` tab.

- Switch to the page you want to inspect, then reopen QA Toolkit.
- Do not start a tool from `chrome://`, `file://`, the Chrome Web Store, or another extension page.

## EnvCompare cannot generate the target URL

Automatic generation only supports the hostname patterns implemented by EnvCompare. In particular, it recognises common SIT/UAT/STAGE/PROD subdomain and hyphenated naming patterns.

If it cannot recognise the source hostname:

1. Select the intended target environment.
2. Enter the full target URL in the editable **Target URL** field.
3. Select **Compare Pages**.

Use **Regenerate URL** to restore the generated value after editing it.

## EnvCompare report is incomplete or fails

Check the following:

- The target URL is reachable and you have access to it.
- The target page completes loading within 30 seconds.
- The page does not require a login or interaction that the newly opened target tab cannot complete.
- The source and target pages are displaying the intended equivalent route.

EnvCompare waits an additional two seconds after target tab loading before extracting data, but highly dynamic content can still be absent or different at capture time.

## Link or image health results appear limited

EnvCompare checks at most 50 links and 50 images per page. Link checking is restricted to visible same-origin links. This is expected behavior, not necessarily an indication that every page resource was validated.

## Visual comparison is unavailable

Visual comparison depends on component discovery and screenshot capture in both tabs. It can be unavailable when a component cannot be located or measured, a screenshot cannot be captured, or the page layout changes during capture.

Review the functional and detailed-differences sections as an alternative source of comparison information.

## Bug Evidence Collector shows no console errors or failed requests

The collector records events observed after its page-monitoring script is installed. Reload the website page, reproduce the issue, and then collect evidence.

No failed API request is shown when requests succeed or when the request is to an ignored analytics/monitoring domain. A request with HTTP status 400 or higher, or a network failure, is treated as a failed request.

## Screenshot capture fails

Bug Evidence Collector captures the visible portion of the current tab. If capture fails:

1. Keep the affected website tab active.
2. Ensure the page is not a restricted Chrome or extension page.
3. Reload QA Toolkit from `chrome://extensions`.
4. Refresh the page and collect evidence again.

The tool can still download `evidence.json` and `bug-report.txt` when screenshot capture is unavailable.

## API Watchdog has no events

1. Open API Watchdog from the QA Toolkit launcher.
2. Select **Enable on this host** in the in-page panel.
3. Reload or interact with the page to generate `fetch` or `XMLHttpRequest` activity.
4. Confirm that the selected page session and filter include the expected events.

API Watchdog only observes `fetch` and `XMLHttpRequest`; it does not record API activity that does not use those browser APIs.

## API Watchdog does not show request or response bodies

This is expected unless **Deep Capture** is enabled. For a production-like host, also select **Allow Deep on PROD**. Review data carefully before enabling deep capture or copying/exporting results.

## Before reporting a problem

Provide:

- the tool used;
- the source URL and, for EnvCompare, target URL;
- the action taken;
- the visible error message;
- a sanitised screenshot or downloaded output if permitted.

Do not include credentials, tokens, session cookies, or unreviewed captured request/response data.
