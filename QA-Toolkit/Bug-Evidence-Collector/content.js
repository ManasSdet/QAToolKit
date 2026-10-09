// =======================================================
// BUG EVIDENCE COLLECTOR
// EXTENSION BRIDGE - ISOLATED WORLD
// =======================================================

(() => {

    // Prevent duplicate installation
    if (
        window
            .__BUG_EVIDENCE_EXTENSION_BRIDGE_INSTALLED__
    ) {

        return;

    }


    window
        .__BUG_EVIDENCE_EXTENSION_BRIDGE_INSTALLED__ =
        true;


    // ===================================================
    // STORED EVIDENCE
    // ===================================================

    let consoleErrors =
        [];


    let apiFailures =
        [];


    const MAX_ERRORS =
        100;


    const MAX_API_FAILURES =
        100;


    // ===================================================
    // STORE CONSOLE ERROR
    // ===================================================

    function addConsoleError(
        error
    ) {

        if (!error) {

            return;

        }


        consoleErrors.push(
            error
        );


        if (
            consoleErrors.length >
            MAX_ERRORS
        ) {

            consoleErrors =
                consoleErrors.slice(
                    -MAX_ERRORS
                );

        }


        console.log(
            "[Bug Evidence Collector] Console error stored:",
            error
        );

    }


    // ===================================================
    // STORE API FAILURE
    // ===================================================

    function addApiFailure(
        apiFailure
    ) {

        if (!apiFailure) {

            return;

        }


        apiFailures.push(
            apiFailure
        );


        if (
            apiFailures.length >
            MAX_API_FAILURES
        ) {

            apiFailures =
                apiFailures.slice(
                    -MAX_API_FAILURES
                );

        }


        console.log(
            "[Bug Evidence Collector] API failure stored:",
            apiFailure
        );

    }


    // ===================================================
    // RECEIVE MAIN WORLD EVENTS
    // ===================================================
    window.addEventListener(
        "message",
        function (event) {

            if (
                event.source !==
                window
            ) {

                return;

            }


            const message =
                event.data;


            if (
                !message ||
                message.source !==
                    "BUG_EVIDENCE_COLLECTOR"
            ) {

                return;

            }


            // =================================================
            // CONSOLE ERROR
            // =================================================

            if (
                message.action ===
                "CONSOLE_ERROR_CAPTURED"
            ) {

                addConsoleError(
                    message.payload
                );


                return;

            }


            // =================================================
            // API FAILURE
            // =================================================

            if (
                message.action ===
                "API_FAILURE_CAPTURED"
            ) {

                addApiFailure(
                    message.payload
                );


                return;

            }

        }
    );


    // ===================================================
    // POPUP COMMUNICATION
    // ===================================================

    chrome.runtime.onMessage.addListener(

        function (
            request,
            sender,
            sendResponse
        ) {

            if (!request) {

                return false;

            }


            // =================================================
            // GET CONSOLE ERRORS
            // =================================================

            if (
                request.action ===
                "GET_CONSOLE_ERRORS"
            ) {

                sendResponse(
                    {
                        success:
                            true,

                        count:
                            consoleErrors.length,

                        errors:
                            consoleErrors
                    }
                );


                return false;

            }


            // =================================================
            // GET API FAILURES
            // =================================================

            if (
                request.action ===
                "GET_API_FAILURES"
            ) {

                sendResponse(
                    {
                        success:
                            true,

                        count:
                            apiFailures.length,

                        failures:
                            apiFailures
                    }
                );


                return false;

            }



            // =================================================
            // CLEAR EVIDENCE
            // =================================================

            if (
                request.action ===
                "CLEAR_EVIDENCE"
            ) {

                consoleErrors =
                    [];


                apiFailures =
                    [];


                sendResponse(
                    {
                        success:
                            true
                    }
                );


                return false;

            }


            return false;

        }

    );


    console.log(
        "[Bug Evidence Collector] Extension bridge installed."
    );

})();