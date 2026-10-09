// =======================================================
// BUG EVIDENCE COLLECTOR
// PAGE MONITOR - MAIN WORLD
// =======================================================

(() => {

    // Prevent duplicate installation
    if (
        window.__BUG_EVIDENCE_PAGE_MONITOR_INSTALLED__
    ) {
        return;
    }

    window.__BUG_EVIDENCE_PAGE_MONITOR_INSTALLED__ =
        true;


    // ===================================================
    // SEND DATA TO EXTENSION BRIDGE
    // ===================================================

    function sendToExtension(
        action,
        payload
    ) {

        window.postMessage(
            {
                source:
                    "BUG_EVIDENCE_COLLECTOR",

                action:
                    action,

                payload:
                    payload
            },
            "*"
        );

    }


    // ===================================================
    // IGNORE ANALYTICS / TRACKING REQUESTS
    // ===================================================

    function shouldIgnoreRequest(
        url
    ) {

        if (!url) {
            return false;
        }


        const ignoredDomains =
        [
            "google-analytics.com",
            "analytics.google.com",
            "googletagmanager.com",
            "doubleclick.net",
            "googlesyndication.com",
            "googleadservices.com",
            "facebook.com/tr",
            "connect.facebook.net",
            "clarity.ms",
            "hotjar.com",
            "newrelic.com",
            "nr-data.net"
        ];


        const normalizedUrl =
            String(
                url
            )
                .toLowerCase();


        return ignoredDomains.some(
            domain =>
                normalizedUrl.includes(
                    domain
                )
        );

    }


    // ===================================================
    // FORMAT VALUES
    // ===================================================

    function formatValue(
        value
    ) {

        if (
            value instanceof Error
        ) {

            return (
                value.stack ||
                value.message
            );

        }


        if (
            typeof value ===
            "object"
        ) {

            try {

                return JSON.stringify(
                    value
                );

            }

            catch {

                return String(
                    value
                );

            }

        }


        return String(
            value
        );

    }


    // ===================================================
    // CONSOLE.ERROR CAPTURE
    // ===================================================

    const originalConsoleError =
        console.error.bind(
            console
        );


    console.error =
        function (...args) {

            originalConsoleError(
                ...args
            );


            const message =
                args
                    .map(
                        formatValue
                    )
                    .join(
                        " "
                    );


            sendToExtension(
                "CONSOLE_ERROR_CAPTURED",
                {
                    type:
                        "console.error",

                    message:
                        message,

                    source:
                        window.location.href,

                    timestamp:
                        new Date()
                            .toISOString()
                }
            );

        };


    // ===================================================
    // UNCAUGHT JAVASCRIPT ERRORS
    // ===================================================

    window.addEventListener(
        "error",
        function (
            event
        ) {

            sendToExtension(
                "CONSOLE_ERROR_CAPTURED",
                {
                    type:
                        "uncaught-error",

                    message:
                        event.message ||
                        "Unknown JavaScript error",

                    source:
                        event.filename ||
                        window.location.href,

                    line:
                        event.lineno ||
                        null,

                    column:
                        event.colno ||
                        null,

                    stack:
                        event.error?.stack ||
                        null,

                    timestamp:
                        new Date()
                            .toISOString()
                }
            );

        }
    );


    // ===================================================
    // UNHANDLED PROMISE REJECTIONS
    // ===================================================

    window.addEventListener(
        "unhandledrejection",
        function (
            event
        ) {

            let message;


            if (
                event.reason instanceof
                Error
            ) {

                message =
                    event.reason.stack ||
                    event.reason.message;

            }

            else {

                message =
                    formatValue(
                        event.reason
                    );

            }


            sendToExtension(
                "CONSOLE_ERROR_CAPTURED",
                {
                    type:
                        "unhandled-promise-rejection",

                    message:
                        message,

                    source:
                        window.location.href,

                    timestamp:
                        new Date()
                            .toISOString()
                }
            );

        }
    );


    // ===================================================
    // FETCH MONITORING
    // ===================================================

    const originalFetch =
        window.fetch;


    if (
        originalFetch
    ) {

        window.fetch =
            async function (
                ...args
            ) {

                const startedAt =
                    performance.now();


                let requestUrl =
                    "Unknown";


                let method =
                    "GET";


                try {

                    const input =
                        args[0];


                    const options =
                        args[1] ||
                        {};


                    // =====================================
                    // REQUEST URL
                    // =====================================

                    if (
                        typeof input ===
                        "string"
                    ) {

                        requestUrl =
                            input;

                    }

                    else if (
                        input &&
                        input.url
                    ) {

                        requestUrl =
                            input.url;


                        method =
                            input.method ||
                            method;

                    }


                    if (
                        options.method
                    ) {

                        method =
                            options.method;

                    }


                    method =
                        String(
                            method
                        )
                            .toUpperCase();


                    // =====================================
                    // ORIGINAL FETCH
                    // =====================================

                    const response =
                        await originalFetch.apply(
                            this,
                            args
                        );


                    const duration =
                        Math.round(
                            performance.now() -
                            startedAt
                        );


                    // =====================================
                    // HTTP 4xx / 5xx
                    // =====================================

                    if (
                        !response.ok
                    ) {

                        if (
                            !shouldIgnoreRequest(
                                requestUrl
                            )
                        ) {

                            sendToExtension(
                                "API_FAILURE_CAPTURED",
                                {
                                    apiType:
                                        "fetch",

                                    method:
                                        method,

                                    url:
                                        requestUrl,

                                    status:
                                        response.status,

                                    statusText:
                                        response.statusText ||
                                        "HTTP Error",

                                    durationMs:
                                        duration,

                                    timestamp:
                                        new Date()
                                            .toISOString()
                                }
                            );

                        }

                        else {

                            console.debug(
                                "[Bug Evidence Collector] Ignored analytics failure:",
                                requestUrl
                            );

                        }

                    }


                    return response;

                }


                catch (
                    error
                ) {

                    const duration =
                        Math.round(
                            performance.now() -
                            startedAt
                        );


                    // =====================================
                    // NETWORK FAILURE
                    // =====================================

                    if (
                        !shouldIgnoreRequest(
                            requestUrl
                        )
                    ) {

                        sendToExtension(
                            "API_FAILURE_CAPTURED",
                            {
                                apiType:
                                    "fetch",

                                method:
                                    method,

                                url:
                                    requestUrl,

                                status:
                                    0,

                                statusText:
                                    "Network Error",

                                error:
                                    error?.message ||
                                    String(
                                        error
                                    ),

                                durationMs:
                                    duration,

                                timestamp:
                                    new Date()
                                        .toISOString()
                            }
                        );

                    }

                    else {

                        console.debug(
                            "[Bug Evidence Collector] Ignored analytics network failure:",
                            requestUrl
                        );

                    }


                    // Preserve normal website behavior
                    throw error;

                }

            };

    }


    // ===================================================
    // XMLHttpRequest MONITORING
    // ===================================================

    if (
        window.XMLHttpRequest
    ) {

        const originalOpen =
            XMLHttpRequest
                .prototype
                .open;


        const originalSend =
            XMLHttpRequest
                .prototype
                .send;


        // =================================================
        // XHR OPEN
        // =================================================

        XMLHttpRequest
            .prototype
            .open =
            function (
                method,
                url,
                ...rest
            ) {

                this.__bugEvidenceRequest =
                {
                    method:
                        String(
                            method ||
                            "GET"
                        )
                            .toUpperCase(),

                    url:
                        String(
                            url
                        ),

                    startedAt:
                        null
                };


                return originalOpen.call(
                    this,
                    method,
                    url,
                    ...rest
                );

            };


        // =================================================
        // XHR SEND
        // =================================================

        XMLHttpRequest
            .prototype
            .send =
            function (
                ...args
            ) {

                const xhr =
                    this;


                const requestInfo =
                    xhr.__bugEvidenceRequest ||
                    {
                        method:
                            "GET",

                        url:
                            "Unknown",

                        startedAt:
                            null
                    };


                requestInfo.startedAt =
                    performance.now();


                let captured =
                    false;


                // =========================================
                // CAPTURE FAILURE
                // =========================================

                function captureFailure(
                    failureType
                ) {

                    if (
                        captured
                    ) {
                        return;
                    }


                    const status =
                        xhr.status ||
                        0;


                    const isHttpFailure =
                        status >= 400;


                    const isNetworkFailure =
                        failureType ===
                            "Network Error" ||

                        failureType ===
                            "Timeout" ||

                        failureType ===
                            "Request Aborted";


                    if (
                        !isHttpFailure &&
                        !isNetworkFailure
                    ) {

                        return;

                    }


                    if (
                        shouldIgnoreRequest(
                            requestInfo.url
                        )
                    ) {

                        console.debug(
                            "[Bug Evidence Collector] Ignored analytics XHR failure:",
                            requestInfo.url
                        );

                        return;

                    }


                    captured =
                        true;


                    const duration =
                        Math.round(
                            performance.now() -
                            requestInfo.startedAt
                        );


                    sendToExtension(
                        "API_FAILURE_CAPTURED",
                        {
                            apiType:
                                "XMLHttpRequest",

                            method:
                                requestInfo.method,

                            url:
                                requestInfo.url,

                            status:
                                status,

                            statusText:
                                xhr.statusText ||
                                failureType,

                            durationMs:
                                duration,

                            timestamp:
                                new Date()
                                    .toISOString()
                        }
                    );

                }


                // =========================================
                // COMPLETED REQUEST
                // =========================================

                xhr.addEventListener(
                    "loadend",
                    () => {

                        captureFailure(
                            "Completed"
                        );

                    }
                );


                // =========================================
                // NETWORK ERROR
                // =========================================

                xhr.addEventListener(
                    "error",
                    () => {

                        captureFailure(
                            "Network Error"
                        );

                    }
                );


                // =========================================
                // TIMEOUT
                // =========================================

                xhr.addEventListener(
                    "timeout",
                    () => {

                        captureFailure(
                            "Timeout"
                        );

                    }
                );


                // =========================================
                // ABORT
                // =========================================

                xhr.addEventListener(
                    "abort",
                    () => {

                        captureFailure(
                            "Request Aborted"
                        );

                    }
                );


                return originalSend.apply(
                    xhr,
                    args
                );

            };

    }


    console.log(
        "[Bug Evidence Collector] Page monitor installed."
    );

})();