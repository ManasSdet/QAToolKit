document.addEventListener(
    "DOMContentLoaded",
    initializeLauncher
);

function initializeLauncher() {

    /*
     * EnvCompare
     */
    const envCompare =
        document.getElementById(
            "envCompare"
        );

    if (envCompare) {

    envCompare.addEventListener(
        "click",
        () => {

            openToolInPopup(
                "../EnvCompare/popup.html"
            );

        }
    );

}


    /*
     * Bug Evidence Collector
     */
    const bugEvidenceCollector =
        document.getElementById(
            "BugEvidenceCollector"
        );

    if (bugEvidenceCollector) {

    bugEvidenceCollector.addEventListener(
        "click",
        () => {

            openToolInPopup(
                "../Bug-Evidence-Collector/popup.html"
            );

        }
    );

}


    /*
     * API Watchdog
     */
    const apiWatchdog =
        document.getElementById(
            "APIWatchdog"
        );

    if (apiWatchdog) {

        apiWatchdog.addEventListener(
            "click",
            startAPIWatchdog
        );

    }

}

async function openEnvCompare() {

    try {

        // Get the website tab BEFORE opening EnvCompare
        const [tab] =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        if (
            !tab ||
            !tab.id ||
            !tab.url
        ) {

            alert(
                "Unable to find active page."
            );

            return;

        }


        // EnvCompare should only start from a website
        if (
            !tab.url.startsWith("http://") &&
            !tab.url.startsWith("https://")
        ) {

            alert(
                "Please open a website before starting EnvCompare."
            );

            return;

        }


        // Create EnvCompare URL
        const envCompareUrl =
            new URL(
                chrome.runtime.getURL(
                    "EnvCompare/popup.html"
                )
            );


        // Pass original website tab ID to EnvCompare
        envCompareUrl.searchParams.set(
            "sourceTabId",
            String(tab.id)
        );


        // Open EnvCompare
        await chrome.tabs.create({
            url:
                envCompareUrl.toString()
        });


        window.close();

    }
    catch (error) {

        console.error(
            "EnvCompare launch failed:",
            error
        );


        alert(
            "Unable to start EnvCompare."
        );

    }

}

async function openToolInPopup(pagePath) {

    try {

        // Get currently active WEBSITE tab
        const [tab] =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

        if (
            !tab ||
            !tab.id ||
            !tab.url
        ) {
            alert(
                "Unable to find active website."
            );
            return;
        }

        if (
            !tab.url.startsWith("http://") &&
            !tab.url.startsWith("https://")
        ) {
            alert(
                "Please open a website before starting this tool."
            );
            return;
        }

        // Navigate INSIDE the same extension popup
        window.location.href =
            pagePath +
            "?sourceTabId=" +
            encodeURIComponent(
                String(tab.id)
            );

    }
    catch (error) {

        console.error(
            "Unable to open tool:",
            error
        );

        alert(
            "Unable to open this tool."
        );
    }
}


async function startAPIWatchdog() {

    try {

        const [tab] =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        if (
            !tab ||
            !tab.id ||
            !tab.url
        ) {

            alert(
                "Unable to find active page."
            );

            return;

        }


        if (
            !tab.url.startsWith("http://") &&
            !tab.url.startsWith("https://")
        ) {

            alert(
                "Please open a website before starting API Watchdog."
            );

            return;

        }


        /*
         * Tell API Watchdog content script
         * to open its panel.
         */
        const response =
            await chrome.tabs.sendMessage(
                tab.id,
                {
                    type:
                        "aw:openPanel"
                }
            );


        if (
            response &&
            response.ok === false
        ) {

            throw new Error(
                response.error ||
                "Unable to open API Watchdog."
            );

        }


        window.close();

    }
    catch (error) {

        console.error(
            "API Watchdog launch failed:",
            error
        );

        alert(
            "Unable to start API Watchdog. Reload the page and try again."
        );

    }

}