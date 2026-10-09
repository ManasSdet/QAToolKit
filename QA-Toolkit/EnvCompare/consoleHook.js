(() => {

    /*
     * Do not install twice.
     */

    if (
        window.__ENVCOMPARE_CONSOLE_HOOK_INSTALLED__
    ) {
        return;
    }


    window.__ENVCOMPARE_CONSOLE_HOOK_INSTALLED__ =
        true;


    window.__ENVCOMPARE_CONSOLE_ERRORS__ =
        window.__ENVCOMPARE_CONSOLE_ERRORS__ ||
        [];


    const MAX_ERRORS =
        100;


    /*
     * =====================================================
     * HELPERS
     * =====================================================
     */

    function safeStringify(
        value
    ) {

        if (
            typeof value === "string"
        ) {
            return value;
        }


        if (
            value instanceof Error
        ) {

            return (
                value.name +
                ": " +
                value.message
            );

        }


        try {

            const seen =
                new WeakSet();


            return JSON.stringify(
                value,
                (
                    key,
                    item
                ) => {

                    if (
                        typeof item ===
                            "object" &&
                        item !== null
                    ) {

                        if (
                            seen.has(item)
                        ) {
                            return "[Circular]";
                        }


                        seen.add(item);

                    }


                    return item;

                }
            );

        }

        catch {

            try {

                return String(value);

            }

            catch {

                return "[Unable to serialize]";

            }

        }

    }



    function pushError(
        error
    ) {

        const collection =
            window
                .__ENVCOMPARE_CONSOLE_ERRORS__;


        if (
            !Array.isArray(
                collection
            )
        ) {
            return;
        }


        /*
         * Avoid uncontrolled growth.
         */

        if (
            collection.length >=
            MAX_ERRORS
        ) {
            return;
        }


        collection.push({

            type:
                error.type ||
                "error",

            message:
                error.message ||
                "",

            source:
                error.source ||
                "",

            line:
                error.line ||
                0,

            column:
                error.column ||
                0,

            timestamp:
                new Date()
                    .toISOString()

        });

    }



    /*
     * =====================================================
     * CONSOLE.ERROR
     * =====================================================
     */

    const originalConsoleError =
        console.error;


    console.error =
        function(...args) {

            try {

                const message =
                    args
                        .map(
                            item =>
                                safeStringify(
                                    item
                                )
                        )
                        .join(" ");


                pushError({

                    type:
                        "console.error",

                    message

                });

            }

            catch {

                /*
                 * Never interfere with actual page console.
                 */

            }


            return originalConsoleError
                .apply(
                    console,
                    args
                );

        };



    /*
     * =====================================================
     * UNCAUGHT JAVASCRIPT ERRORS
     * =====================================================
     */

    window.addEventListener(
        "error",
        event => {

            /*
             * JavaScript runtime error.
             */

            if (
                event.error ||
                event.message
            ) {

                pushError({

                    type:
                        "javascript",

                    message:
                        event.message ||
                        event.error
                            ?.message ||
                        "Unknown JavaScript error",

                    source:
                        event.filename ||
                        "",

                    line:
                        event.lineno ||
                        0,

                    column:
                        event.colno ||
                        0

                });


                return;

            }


            /*
             * Resource load errors:
             * script/image/css etc.
             */

            const target =
                event.target;


            if (
                !target ||
                target === window
            ) {
                return;
            }


            const tagName =
                target.tagName ||
                "RESOURCE";


            const resourceUrl =
                target.src ||
                target.href ||
                "";


            if (
                resourceUrl
            ) {

                pushError({

                    type:
                        "resource",

                    message:
                        `Failed to load ${tagName}: ${resourceUrl}`,

                    source:
                        resourceUrl

                });

            }

        },

        /*
         * Capture phase is required for
         * resource load errors.
         */

        true

    );



    /*
     * =====================================================
     * UNHANDLED PROMISE REJECTIONS
     * =====================================================
     */

    window.addEventListener(
        "unhandledrejection",
        event => {

            let message =
                "Unhandled Promise rejection";


            try {

                if (
                    event.reason
                ) {

                    message =
                        safeStringify(
                            event.reason
                        );

                }

            }

            catch {

                /*
                 * Keep default.
                 */

            }


            pushError({

                type:
                    "unhandledrejection",

                message

            });

        }
    );

})();