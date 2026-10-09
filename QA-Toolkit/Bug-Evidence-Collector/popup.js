// =======================================================
// BUG EVIDENCE COLLECTOR - POPUP
// =======================================================


// =======================================================
// GLOBAL VARIABLES
// =======================================================

let latestEvidence = null;
let latestScreenshotDataUrl = null;


// =======================================================
// FORMAT CAPTURED TIME IN IST
// =======================================================

function formatCapturedTimeIST(timestamp) {

    if (!timestamp) {
        return "Unknown";
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return "Unknown";
    }

    return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }) + " IST";
}


// =======================================================
// HTML ELEMENTS
// =======================================================

const collectBtn =
    document.getElementById("collectBtn");

const status =
    document.getElementById("status");

const result =
    document.getElementById("result");

const evidenceOutput =
    document.getElementById("evidenceOutput");

const screenshotSection =
    document.getElementById("screenshotSection");

const screenshotPreview =
    document.getElementById("screenshotPreview");

const consoleSection =
    document.getElementById("consoleSection");

const consoleErrorList =
    document.getElementById("consoleErrorList");

const consoleErrorCount =
    document.getElementById("consoleErrorCount");

const apiSection =
    document.getElementById("apiSection");

const apiFailureList =
    document.getElementById("apiFailureList");

const apiFailureCount =
    document.getElementById("apiFailureCount");

const copyJiraBtn =
    document.getElementById("copyJiraBtn");

const downloadReportBtn =
    document.getElementById("downloadReportBtn");


// =======================================================
// EVENT LISTENERS
// =======================================================

collectBtn.addEventListener(
    "click",
    collectEvidence
);

copyJiraBtn.addEventListener(
    "click",
    copyEvidenceForJira
);

downloadReportBtn.addEventListener(
    "click",
    downloadEvidencePackage
);


// =======================================================
// COLLECT EVIDENCE
// =======================================================

async function collectEvidence() {

    try {

        collectBtn.disabled = true;

        status.textContent =
            "Collecting evidence...";


        // Hide previous result sections

        result.classList.add("hidden");

        screenshotSection.classList.add(
            "hidden"
        );

        consoleSection.classList.add(
            "hidden"
        );

        apiSection.classList.add(
            "hidden"
        );

        copyJiraBtn.classList.add(
            "hidden"
        );

        downloadReportBtn.classList.add(
            "hidden"
        );

        latestScreenshotDataUrl = null;


        // =================================================
        // USER INPUT
        // =================================================

        const bugTitle =
            document
                .getElementById("bugTitle")
                .value
                .trim();

        const bugNotes =
            document
                .getElementById("bugNotes")
                .value
                .trim();


        // =================================================
        // SELECTED OPTIONS
        // =================================================

        const collectPageDetails =
            document
                .getElementById("pageDetails")
                .checked;

        const collectBrowserInfo =
            document
                .getElementById("browserInfo")
                .checked;

        const collectScreenshot =
            document
                .getElementById("screenshot")
                .checked;

        const collectConsoleErrors =
            document
                .getElementById("consoleErrors")
                .checked;

        const collectApiFailures =
            document
                .getElementById("apiFailures")
                .checked;


        // =================================================
        // GET CURRENT TAB
        // =================================================

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

        const currentTab =
            tabs[0];

        if (!currentTab) {

            throw new Error(
                "Unable to detect current browser tab."
            );

        }


        // =================================================
        // CREATE EVIDENCE OBJECT
        // =================================================

        const evidence = {

            bug: {

                title:
                    bugTitle ||
                    "No title provided",

                notes:
                    bugNotes ||
                    "No notes provided"

            },

            // Store only Indian Standard Time
            capturedAt:
                formatCapturedTimeIST(
                    new Date().toISOString()
                )

        };


        // =================================================
        // PAGE DETAILS
        // =================================================

        if (collectPageDetails) {

            evidence.page = {

                title:
                    currentTab.title ||
                    "Unknown",

                url:
                    currentTab.url ||
                    "Unknown"

            };

        }


        // =================================================
        // BROWSER / ENVIRONMENT DETAILS
        // =================================================

        if (collectBrowserInfo) {

            evidence.environment = {

                userAgent:
                    navigator.userAgent,

                platform:
                    navigator.platform,

                language:
                    navigator.language,

                screenResolution:
                    `${screen.width} x ${screen.height}`

            };

        }


        // =================================================
        // SCREENSHOT CAPTURE
        // =================================================

        if (collectScreenshot) {

            status.textContent =
                "Capturing screenshot...";

            try {

                const screenshotDataUrl =
                    await chrome.tabs.captureVisibleTab(

                        currentTab.windowId,

                        {
                            format: "png"
                        }

                    );

                const finalScreenshotDataUrl =
                    screenshotDataUrl;


                latestScreenshotDataUrl =
                    finalScreenshotDataUrl;


                screenshotPreview.src =
                    finalScreenshotDataUrl;


                screenshotSection
                    .classList
                    .remove("hidden");


                evidence.screenshot = {

                    captured:
                        true,

                    format:
                        "PNG"

                };

            }

            catch (error) {

                console.error(
                    "Screenshot capture failed:",
                    error
                );

                evidence.screenshot = {

                    captured:
                        false,

                    error:
                        error.message

                };

            }

        }


        // =================================================
        // CONSOLE ERROR CAPTURE
        // =================================================

        if (collectConsoleErrors) {

            status.textContent =
                "Collecting console errors...";

            try {

                const response =
                    await chrome.tabs.sendMessage(

                        currentTab.id,

                        {
                            action:
                                "GET_CONSOLE_ERRORS"
                        }

                    );

                const errors =
                    response?.errors ||
                    [];


                evidence.consoleErrors = {

                    count:
                        errors.length,

                    errors:
                        errors

                };


                displayConsoleErrors(
                    errors
                );

            }

            catch (error) {

                console.error(
                    "Unable to collect console errors:",
                    error
                );


                evidence.consoleErrors = {

                    count:
                        0,

                    errors:
                        [],

                    collectionError:
                        error.message

                };


                displayConsoleErrors(
                    []
                );

            }

        }


        // =================================================
        // FAILED API CAPTURE
        // =================================================

        if (collectApiFailures) {

            status.textContent =
                "Collecting failed API requests...";

            try {

                const response =
                    await chrome.tabs.sendMessage(

                        currentTab.id,

                        {
                            action:
                                "GET_API_FAILURES"
                        }

                    );

                const failures =
                    response?.failures ||
                    [];


                evidence.apiFailures = {

                    count:
                        failures.length,

                    failures:
                        failures

                };


                displayApiFailures(
                    failures
                );

            }

            catch (error) {

                console.error(
                    "Unable to collect API failures:",
                    error
                );


                evidence.apiFailures = {

                    count:
                        0,

                    failures:
                        [],

                    collectionError:
                        error.message

                };


                displayApiFailures(
                    []
                );

            }

        }


        // =================================================
        // SAVE LATEST EVIDENCE
        // =================================================

        latestEvidence =
            evidence;


        // =================================================
        // DISPLAY EVIDENCE JSON
        // =================================================

        evidenceOutput.textContent =
            JSON.stringify(
                evidence,
                null,
                2
            );


        result
            .classList
            .remove(
                "hidden"
            );


        // =================================================
        // SHOW ACTION BUTTONS
        // =================================================

        copyJiraBtn
            .classList
            .remove(
                "hidden"
            );


        downloadReportBtn
            .classList
            .remove(
                "hidden"
            );


        status.textContent =
            "✅ Evidence collected successfully";


        console.log(
            "Bug Evidence:",
            evidence
        );

    }

    catch (error) {

        console.error(
            "Evidence collection failed:",
            error
        );


        status.textContent =
            `❌ ${error.message}`;


        evidenceOutput.textContent =
            error.message;


        result
            .classList
            .remove(
                "hidden"
            );

    }

    finally {

        collectBtn.disabled =
            false;

    }

}


// =======================================================
// DISPLAY CONSOLE ERRORS
// =======================================================

function displayConsoleErrors(
    errors
) {

    consoleSection
        .classList
        .remove(
            "hidden"
        );


    consoleErrorCount.textContent =
        errors.length;


    consoleErrorList.innerHTML =
        "";


    if (
        errors.length === 0
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "no-errors";


        element.textContent =
            "✅ No console errors captured.";


        consoleErrorList.appendChild(
            element
        );


        return;

    }


    errors.forEach(

        (
            error,
            index
        ) => {

            const container =
                document.createElement(
                    "div"
                );


            container.className =
                "console-error";


            const type =
                document.createElement(
                    "div"
                );


            type.className =
                "console-error-type";


            type.textContent =
                `${index + 1}. ${error.type || "Console Error"}`;


            const message =
                document.createElement(
                    "div"
                );


            message.className =
                "console-error-message";


            message.textContent =
                error.message ||
                "Unknown error";


            const source =
                document.createElement(
                    "div"
                );


            source.className =
                "console-error-source";


            let sourceText =
                error.source ||
                "Unknown source";


            if (
                error.line
            ) {

                sourceText +=
                    `:${error.line}`;

            }


            if (
                error.column
            ) {

                sourceText +=
                    `:${error.column}`;

            }


            source.textContent =
                sourceText;


            container.appendChild(
                type
            );


            container.appendChild(
                message
            );


            container.appendChild(
                source
            );


            consoleErrorList.appendChild(
                container
            );

        }

    );

}


// =======================================================
// DISPLAY FAILED API REQUESTS
// =======================================================

function displayApiFailures(
    failures
) {

    apiSection
        .classList
        .remove(
            "hidden"
        );


    apiFailureCount.textContent =
        failures.length;


    apiFailureList.innerHTML =
        "";


    if (
        failures.length === 0
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "no-errors";


        element.textContent =
            "✅ No failed API requests captured.";


        apiFailureList.appendChild(
            element
        );


        return;

    }


    failures.forEach(

        (
            failure,
            index
        ) => {

            const container =
                document.createElement(
                    "div"
                );


            container.className =
                "api-failure";


            const method =
                document.createElement(
                    "div"
                );


            method.className =
                "api-method";


            method.textContent =
                `${index + 1}. ${failure.method || "GET"} • ${failure.apiType || "API"}`;


            const url =
                document.createElement(
                    "div"
                );


            url.className =
                "api-url";


            url.textContent =
                failure.url ||
                "Unknown URL";


            const apiStatus =
                document.createElement(
                    "div"
                );


            apiStatus.className =
                "api-status";


            apiStatus.textContent =
                `Status: ${failure.status ?? "Unknown"} ${failure.statusText || ""}`;


            const details =
                document.createElement(
                    "div"
                );


            details.className =
                "api-details";


            details.textContent =
                `Duration: ${failure.durationMs ?? "Unknown"} ms`;


            container.appendChild(
                method
            );


            container.appendChild(
                url
            );


            container.appendChild(
                apiStatus
            );


            container.appendChild(
                details
            );


            apiFailureList.appendChild(
                container
            );

        }

    );

}


// =======================================================
// BUILD JIRA TEXT
// =======================================================

function buildJiraText(
    evidence
) {

    const lines =
        [];


    // ===================================================
    // SUMMARY
    // ===================================================

    lines.push(
        "SUMMARY"
    );


    lines.push(
        evidence.bug?.title ||
        "Bug detected"
    );


    lines.push(
        ""
    );


    // ===================================================
    // DESCRIPTION / ACTION PERFORMED
    // ===================================================

    lines.push(
        "DESCRIPTION"
    );


    lines.push(
        evidence.bug?.notes ||
        "No additional notes provided."
    );


    lines.push(
        ""
    );


    // ===================================================
    // PAGE DETAILS
    // ===================================================

    lines.push(
        "PAGE DETAILS"
    );


    if (
        evidence.page
    ) {

        lines.push(
            `Page Title: ${evidence.page.title || "Unknown"}`
        );


        lines.push(
            `URL: ${evidence.page.url || "Unknown"}`
        );

    }

    else {

        lines.push(
            "Page details not collected."
        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // ENVIRONMENT
    // ===================================================

    lines.push(
        "ENVIRONMENT"
    );


    if (
        evidence.environment
    ) {

        lines.push(
            `Platform: ${evidence.environment.platform || "Unknown"}`
        );


        lines.push(
            `Language: ${evidence.environment.language || "Unknown"}`
        );


        lines.push(
            `Screen Resolution: ${evidence.environment.screenResolution || "Unknown"}`
        );


        lines.push(
            `User Agent: ${evidence.environment.userAgent || "Unknown"}`
        );

    }

    else {

        lines.push(
            "Environment information not collected."
        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // SCREENSHOT
    // ===================================================

    lines.push(
        "SCREENSHOT"
    );


    if (
        evidence.screenshot?.captured
    ) {

        lines.push(
            "Screenshot captured successfully."
        );

    }

    else {

        lines.push(
            "Screenshot not available."
        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // SELECTED BUG AREA
    // ===================================================

    if (
        evidence.bugArea?.selected
    ) {

        lines.push(
            "SELECTED BUG AREA"
        );


        const element =
            evidence.bugArea
                .element;


        if (
            element
        ) {

            lines.push(
                `Element: ${element.tagName || "Unknown"}`
            );


            if (
                element.id
            ) {

                lines.push(
                    `ID: ${element.id}`
                );

            }


            if (
                element.text
            ) {

                lines.push(
                    `Text: ${element.text}`
                );

            }

        }


        lines.push(
            ""
        );

    }


    // ===================================================
    // CONSOLE ERRORS
    // ===================================================

    lines.push(
        "CONSOLE ERRORS"
    );


    const consoleErrors =
        evidence
            .consoleErrors
            ?.errors ||
        [];


    if (
        consoleErrors.length === 0
    ) {

        lines.push(
            "No console errors captured."
        );

    }

    else {

        consoleErrors.forEach(

            (
                error,
                index
            ) => {

                lines.push(
                    `${index + 1}. ${error.type || "Console Error"}`
                );


                lines.push(
                    `Message: ${error.message || "Unknown error"}`
                );


                if (
                    error.source
                ) {

                    lines.push(
                        `Source: ${error.source}`
                    );

                }


                lines.push(
                    ""
                );

            }

        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // FAILED API REQUESTS
    // ===================================================

    lines.push(
        "FAILED API REQUESTS"
    );


    const apiFailures =
        evidence
            .apiFailures
            ?.failures ||
        [];


    if (
        apiFailures.length === 0
    ) {

        lines.push(
            "No failed API requests captured."
        );

    }

    else {

        apiFailures.forEach(

            (
                api,
                index
            ) => {

                lines.push(
                    `${index + 1}. ${api.method || "GET"} ${api.url || "Unknown URL"}`
                );


                lines.push(
                    `Status: ${api.status ?? "Unknown"} ${api.statusText || ""}`
                );


                lines.push(
                    `Duration: ${api.durationMs ?? "Unknown"} ms`
                );


                lines.push(
                    ""
                );

            }

        );

    }


    // ===================================================
    // CAPTURED TIME - IST
    // ===================================================

    lines.push(
        ""
    );


    lines.push(
        "CAPTURED AT"
    );


    lines.push(
        evidence.capturedAt ||
        "Unknown"
    );


    return lines.join(
        "\n"
    );

}


// =======================================================
// COPY FOR JIRA
// =======================================================

async function copyEvidenceForJira() {

    if (
        !latestEvidence
    ) {

        status.textContent =
            "❌ Collect evidence first.";


        return;

    }


    try {

        const jiraText =
            buildJiraText(
                latestEvidence
            );


        await navigator
            .clipboard
            .writeText(
                jiraText
            );


        copyJiraBtn.textContent =
            "✅ Copied for Jira";


        copyJiraBtn
            .classList
            .add(
                "copySuccess"
            );


        status.textContent =
            "✅ Jira formatted evidence copied";


        setTimeout(

            () => {

                copyJiraBtn.textContent =
                    "📋 Copy for Jira";


                copyJiraBtn
                    .classList
                    .remove(
                        "copySuccess"
                    );

            },

            2000

        );

    }

    catch (error) {

        console.error(
            "Failed to copy Jira evidence:",
            error
        );


        status.textContent =
            "❌ Unable to copy evidence";

    }

}


// =======================================================
// DOWNLOAD EVIDENCE PACKAGE
// =======================================================

async function downloadEvidencePackage() {

    if (
        !latestEvidence
    ) {

        status.textContent =
            "❌ Collect evidence first.";


        return;

    }


    try {

        downloadReportBtn.disabled =
            true;


        status.textContent =
            "Preparing evidence package...";


        if (
            !chrome.downloads ||
            !chrome.downloads.download
        ) {

            throw new Error(
                "Downloads permission is not available. Reload the extension."
            );

        }


        const folderName =
            createEvidenceFolderName();


        // =================================================
        // EVIDENCE.JSON
        // =================================================

        const evidenceJson =
            JSON.stringify(

                latestEvidence,

                null,

                2

            );


        await downloadTextFile(

            evidenceJson,

            "application/json",

            `${folderName}/evidence.json`

        );


        // =================================================
        // BUG-REPORT.TXT
        // =================================================

        const bugReportText =
            buildBugReportText(
                latestEvidence
            );


        await downloadTextFile(

            bugReportText,

            "text/plain",

            `${folderName}/bug-report.txt`

        );


        // =================================================
        // SCREENSHOT.PNG
        // =================================================

        if (
            latestScreenshotDataUrl
        ) {

            await chrome.downloads.download({

                url:
                    latestScreenshotDataUrl,

                filename:
                    `${folderName}/screenshot.png`,

                conflictAction:
                    "uniquify",

                saveAs:
                    false

            });

        }


        downloadReportBtn.textContent =
            "✅ Evidence Downloaded";


        downloadReportBtn
            .classList
            .add(
                "downloadSuccess"
            );


        if (
            latestScreenshotDataUrl
        ) {

            status.textContent =
                "✅ Evidence package downloaded successfully";

        }

        else {

            status.textContent =
                "✅ Report downloaded. Screenshot was not captured.";

        }


        setTimeout(

            () => {

                downloadReportBtn.textContent =
                    "⬇️ Download Evidence Report";


                downloadReportBtn
                    .classList
                    .remove(
                        "downloadSuccess"
                    );

            },

            2500

        );

    }

    catch (error) {

        console.error(
            "Evidence download failed:",
            error
        );


        status.textContent =
            `❌ Download failed: ${error.message}`;

    }

    finally {

        downloadReportBtn.disabled =
            false;

    }

}


// =======================================================
// DOWNLOAD TEXT FILE
// =======================================================

async function downloadTextFile(
    content,
    mimeType,
    filename
) {

    const blob =
        new Blob(

            [
                content
            ],

            {
                type:
                    `${mimeType};charset=utf-8`
            }

        );


    const blobUrl =
        URL.createObjectURL(
            blob
        );


    try {

        await chrome.downloads.download({

            url:
                blobUrl,

            filename:
                filename,

            conflictAction:
                "uniquify",

            saveAs:
                false

        });

    }

    finally {

        setTimeout(

            () => {

                URL.revokeObjectURL(
                    blobUrl
                );

            },

            5000

        );

    }

}


// =======================================================
// CREATE PACKAGE FOLDER NAME
// =======================================================

function createEvidenceFolderName() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        )
            .padStart(
                2,
                "0"
            );


    const day =
        String(
            now.getDate()
        )
            .padStart(
                2,
                "0"
            );


    const hours =
        String(
            now.getHours()
        )
            .padStart(
                2,
                "0"
            );


    const minutes =
        String(
            now.getMinutes()
        )
            .padStart(
                2,
                "0"
            );


    const seconds =
        String(
            now.getSeconds()
        )
            .padStart(
                2,
                "0"
            );


    return (
        `bug-evidence-${year}-${month}-${day}-${hours}${minutes}${seconds}`
    );

}


// =======================================================
// BUILD TEXT BUG REPORT
// =======================================================

function buildBugReportText(
    evidence
) {

    const lines =
        [];


    lines.push(
        "BUG EVIDENCE REPORT"
    );


    lines.push(
        "=================================================="
    );


    lines.push(
        ""
    );


    // ===================================================
    // ISSUE SUMMARY
    // ===================================================

    lines.push(
        "ISSUE SUMMARY"
    );


    lines.push(
        evidence.bug?.title ||
        "No issue summary provided"
    );


    lines.push(
        ""
    );


    // ===================================================
    // ACTION PERFORMED
    // ===================================================

    lines.push(
        "ACTION PERFORMED"
    );


    lines.push(
        evidence.bug?.notes ||
        "No action provided"
    );


    lines.push(
        ""
    );


    // ===================================================
    // PAGE DETAILS
    // ===================================================

    lines.push(
        "PAGE DETAILS"
    );


    if (
        evidence.page
    ) {

        lines.push(
            `Title: ${evidence.page.title || "Unknown"}`
        );


        lines.push(
            `URL: ${evidence.page.url || "Unknown"}`
        );

    }

    else {

        lines.push(
            "Page details not collected."
        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // ENVIRONMENT
    // ===================================================

    lines.push(
        "ENVIRONMENT"
    );


    if (
        evidence.environment
    ) {

        lines.push(
            `Platform: ${evidence.environment.platform || "Unknown"}`
        );


        lines.push(
            `Language: ${evidence.environment.language || "Unknown"}`
        );


        lines.push(
            `Screen Resolution: ${evidence.environment.screenResolution || "Unknown"}`
        );


        lines.push(
            `User Agent: ${evidence.environment.userAgent || "Unknown"}`
        );

    }

    else {

        lines.push(
            "Environment information not collected."
        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // SCREENSHOT
    // ===================================================

    lines.push(
        "SCREENSHOT"
    );


    if (
        evidence.screenshot?.captured
    ) {

        lines.push(
            "screenshot.png"
        );

    }

    else {

        lines.push(
            "Screenshot not available."
        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // SELECTED BUG AREA
    // ===================================================

    if (
        evidence.bugArea?.selected
    ) {

        lines.push(
            "SELECTED BUG AREA"
        );


        const element =
            evidence.bugArea
                .element;


        if (
            element
        ) {

            lines.push(
                `Element: ${element.tagName || "Unknown"}`
            );


            if (
                element.id
            ) {

                lines.push(
                    `ID: ${element.id}`
                );

            }


            if (
                element.text
            ) {

                lines.push(
                    `Text: ${element.text}`
                );

            }

        }


        lines.push(
            ""
        );

    }


    // ===================================================
    // CONSOLE ERRORS
    // ===================================================

    lines.push(
        "CONSOLE ERRORS"
    );


    const consoleErrors =
        evidence
            .consoleErrors
            ?.errors ||
        [];


    if (
        consoleErrors.length === 0
    ) {

        lines.push(
            "No console errors captured."
        );

    }

    else {

        consoleErrors.forEach(

            (
                error,
                index
            ) => {

                lines.push(
                    `${index + 1}. ${error.type || "Console Error"}`
                );


                lines.push(
                    `Message: ${error.message || "Unknown error"}`
                );


                if (
                    error.source
                ) {

                    lines.push(
                        `Source: ${error.source}`
                    );

                }


                lines.push(
                    ""
                );

            }

        );

    }


    lines.push(
        ""
    );


    // ===================================================
    // FAILED API REQUESTS
    // ===================================================

    lines.push(
        "FAILED API REQUESTS"
    );


    const apiFailures =
        evidence
            .apiFailures
            ?.failures ||
        [];


    if (
        apiFailures.length === 0
    ) {

        lines.push(
            "No failed API requests captured."
        );

    }

    else {

        apiFailures.forEach(

            (
                api,
                index
            ) => {

                lines.push(
                    `${index + 1}. ${api.method || "GET"} ${api.url || "Unknown URL"}`
                );


                lines.push(
                    `Status: ${api.status ?? "Unknown"} ${api.statusText || ""}`
                );


                lines.push(
                    `Duration: ${api.durationMs ?? "Unknown"} ms`
                );


                lines.push(
                    ""
                );

            }

        );

    }


    // ===================================================
    // CAPTURED TIME - IST
    // ===================================================

    lines.push(
        ""
    );


    lines.push(
        "CAPTURED AT"
    );


    lines.push(
        evidence.capturedAt ||
        "Unknown"
    );


    return lines.join(
        "\n"
    );

}