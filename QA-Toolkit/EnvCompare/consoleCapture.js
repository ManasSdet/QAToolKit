	/* ============================================================
   EnvCompare
   Console Error Capture + Comparison
   ============================================================ */


self.captureConsoleErrors =
    async function captureConsoleErrors(
        tabId
    ) {

        try {

            const result =
                await chrome.scripting
                    .executeScript({

                        target: {
                            tabId
                        },

                        world:
                            "MAIN",

                        func: () => {

                            const errors =
                                window
                                    .__ENVCOMPARE_CONSOLE_ERRORS__;


                            if (
                                !Array.isArray(
                                    errors
                                )
                            ) {

                                return [];

                            }


                            /*
                             * Return safe plain objects.
                             */

                            return errors.map(
                                item => ({

                                    type:
                                        item.type ||
                                        "error",

                                    message:
                                        item.message ||
                                        "",

                                    source:
                                        item.source ||
                                        "",

                                    line:
                                        item.line ||
                                        0,

                                    column:
                                        item.column ||
                                        0,

                                    timestamp:
                                        item.timestamp ||
                                        ""

                                })
                            );

                        }

                    });


            return (
                result?.[0]
                    ?.result ||
                []
            );

        }

        catch (error) {

            console.warn(
                "Unable to capture console errors:",
                error
            );


            return [];

        }

    };



/* ============================================================
   COMPARE SOURCE / TARGET CONSOLE ERRORS
   ============================================================ */

self.compareConsoleErrors =
    function compareConsoleErrors(
        sourceErrors = [],
        targetErrors = []
    ) {

        const normalizedSource =
            deduplicateConsoleErrors(
                sourceErrors
            );


        const normalizedTarget =
            deduplicateConsoleErrors(
                targetErrors
            );


        const common =
            [];


        const sourceOnly =
            [];


        const targetOnly =
            [];


        /*
         * =====================================================
         * SOURCE → TARGET
         * =====================================================
         */

        normalizedSource
            .forEach(
                sourceError => {

                    const match =
                        normalizedTarget
                            .find(
                                targetError =>

                                    getConsoleErrorKey(
                                        sourceError
                                    ) ===

                                    getConsoleErrorKey(
                                        targetError
                                    )
                            );


                    if (
                        match
                    ) {

                        common.push({

                            source:
                                sourceError,

                            target:
                                match

                        });

                    }

                    else {

                        sourceOnly.push(
                            sourceError
                        );

                    }

                }
            );


        /*
         * =====================================================
         * TARGET ONLY
         * =====================================================
         */

        normalizedTarget
            .forEach(
                targetError => {

                    const existsInSource =
                        normalizedSource
                            .some(
                                sourceError =>

                                    getConsoleErrorKey(
                                        sourceError
                                    ) ===

                                    getConsoleErrorKey(
                                        targetError
                                    )
                            );


                    if (
                        !existsInSource
                    ) {

                        targetOnly.push(
                            targetError
                        );

                    }

                }
            );


        return {

            sourceCount:
                normalizedSource.length,

            targetCount:
                normalizedTarget.length,

            commonCount:
                common.length,

            sourceOnlyCount:
                sourceOnly.length,

            targetOnlyCount:
                targetOnly.length,

            sourceErrors:
                normalizedSource,

            targetErrors:
                normalizedTarget,

            common,

            sourceOnly,

            targetOnly,

            match:

                sourceOnly.length === 0 &&
                targetOnly.length === 0

        };

    };



/* ============================================================
   REMOVE DUPLICATES
   ============================================================ */

function deduplicateConsoleErrors(
    errors
) {

    const map =
        new Map();


    errors.forEach(
        error => {

            const normalized = {

                type:
                    String(
                        error.type ||
                        "error"
                    ),

                message:
                    String(
                        error.message ||
                        ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim(),

                source:
                    normalizeConsoleSource(
                        error.source
                    ),

                line:
                    Number(
                        error.line ||
                        0
                    ),

                column:
                    Number(
                        error.column ||
                        0
                    )

            };


            const key =
                getConsoleErrorKey(
                    normalized
                );


            if (
                !map.has(
                    key
                )
            ) {

                map.set(
                    key,
                    normalized
                );

            }

        }
    );


    return Array.from(
        map.values()
    );

}



/* ============================================================
   COMPARISON KEY
   ============================================================ */

function getConsoleErrorKey(
    error
) {

    /*
     * Deliberately don't compare exact hostname.
     *
     * stage.example.com and www.example.com can produce
     * equivalent errors from the same JS path.
     */

    return [

        normalizeConsoleText(
            error.type
        ),

        normalizeConsoleMessage(
            error.message
        ),

        normalizeConsoleSource(
            error.source
        )

    ]
        .join(
            " | "
        );

}



/* ============================================================
   NORMALIZE MESSAGE
   ============================================================ */

function normalizeConsoleMessage(
    value
) {

    let message =
        normalizeConsoleText(
            value
        );


    /*
     * Replace complete http(s) hostnames.
     *
     * Example:
     *
     * https://stage.example.com/path
     * https://www.example.com/path
     *
     * both become:
     *
     * <host>/path
     */

    message =
        message.replace(

            /https?:\/\/[^/\s"'<>]+/gi,

            "<host>"

        );


    return message;

}



/* ============================================================
   NORMALIZE SOURCE URL
   ============================================================ */

function normalizeConsoleSource(
    value
) {

    if (
        !value
    ) {
        return "";
    }


    try {

        const parsed =
            new URL(
                value
            );


        return (
            parsed.pathname +
            parsed.search
        );

    }

    catch {

        return normalizeConsoleText(
            value
        );

    }

}



/* ============================================================
   NORMALIZE TEXT
   ============================================================ */

function normalizeConsoleText(
    value
) {

    return String(
        value ||
        ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .toLowerCase();

}