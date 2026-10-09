/* ============================================================
   EnvCompare
   Visual Component Capture Engine
   ============================================================ */


/*
 * IMPORTANT:
 *
 * This file runs inside the extension service worker.
 *
 * background.js loads it using:
 *
 * importScripts("visualCapture.js");
 *
 * The public function exposed by this file is:
 *
 * captureVisualComparison(sourceTabId, targetTabId)
 */


const VISUAL_CONFIG = {

    /*
     * Maximum meaningful page components
     * captured per environment.
     */

    maxComponents: 12,


    /*
     * Minimum useful component dimensions.
     */

    minWidth: 120,

    minHeight: 60,


    /*
     * Delay after scrolling before measuring/capturing.
     *
     * Gives lazy-loaded content and sticky elements
     * some time to settle.
     */

    settleAfterScrollMs: 500,


    /*
     * Delay between captureVisibleTab calls.
     *
     * Helps avoid browser screenshot rate limits.
     */

    captureDelayMs: 2000,


    /*
     * JPEG quality.
     *
     * Keep this moderate because screenshots are
     * temporarily stored in chrome.storage.local.
     */

    jpegQuality: 55

};



/* ============================================================
   PUBLIC FUNCTION
   ============================================================ */

self.captureVisualComparison =
    async function captureVisualComparison(
        sourceTabId,
        targetTabId
    ) {

        console.log(
            "Starting visual component comparison..."
        );


        let originalActiveTabId =
            null;


        let sourceTab =
            null;


        let targetTab =
            null;


        try {

            /*
             * --------------------------------------------------------
             * Get tabs
             * --------------------------------------------------------
             */

            sourceTab =
                await chrome.tabs.get(
                    sourceTabId
                );


            targetTab =
                await chrome.tabs.get(
                    targetTabId
                );
				
				/*
 * Close OneTrust cookie banner before
 * component discovery and screenshots.
 */

await dismissOneTrustBanner(
    sourceTabId
);


await dismissOneTrustBanner(
    targetTabId
);


            /*
             * Remember currently active tab.
             *
             * We will restore it after screenshots are finished.
             */

            const activeTabs =
                await chrome.tabs.query({

                    active: true,

                    currentWindow: true

                });


            if (
                activeTabs &&
                activeTabs.length > 0
            ) {

                originalActiveTabId =
                    activeTabs[0].id;

            }


            /*
             * --------------------------------------------------------
             * Discover meaningful components
             * --------------------------------------------------------
             */

            console.log(
                "Discovering source visual components..."
            );


            const sourceComponents =
                await discoverVisualComponents(
                    sourceTabId
                );


            console.log(
                "Source components:",
                sourceComponents
            );


            console.log(
                "Discovering target visual components..."
            );


            const targetComponents =
                await discoverVisualComponents(
                    targetTabId
                );


            console.log(
                "Target components:",
                targetComponents
            );


            /*
             * --------------------------------------------------------
             * Match components
             * --------------------------------------------------------
             */

            const matchingResult =
                matchVisualComponents(
                    sourceComponents,
                    targetComponents
                );


            console.log(
                "Visual matching result:",
                matchingResult
            );


            /*
             * --------------------------------------------------------
             * Capture SOURCE matched components
             * --------------------------------------------------------
             */

            const sourceComponentsToCapture =
                matchingResult.matches
                    .map(
                        match =>
                            match.source
                    );


            const sourceCaptures =
                await captureComponents(
                    sourceTabId,
                    sourceTab.windowId,
                    sourceComponentsToCapture
                );


            /*
             * --------------------------------------------------------
             * Capture TARGET matched components
             * --------------------------------------------------------
             */

            const targetComponentsToCapture =
                matchingResult.matches
                    .map(
                        match =>
                            match.target
                    );


            const targetCaptures =
                await captureComponents(
                    targetTabId,
                    targetTab.windowId,
                    targetComponentsToCapture
                );


            /*
             * --------------------------------------------------------
             * Merge screenshot data into matching components
             * --------------------------------------------------------
             */

            const finalMatches =
                matchingResult.matches
                    .map(
                        match => {

                            const sourceCapture =
                                sourceCaptures.find(
                                    item =>
                                        item.uid ===
                                        match.source.uid
                                );


                            const targetCapture =
                                targetCaptures.find(
                                    item =>
                                        item.uid ===
                                        match.target.uid
                                );


                            return {

                                name:
                                    choosePairName(
                                        match.source,
                                        match.target
                                    ),

                                type:
                                    match.source.type ||
                                    match.target.type ||
                                    "component",

                                matchScore:
                                    match.matchScore,


                                source: {

                                    ...match.source,

                                    capture:
                                        sourceCapture
                                            ?.capture ||
                                        null

                                },


                                target: {

                                    ...match.target,

                                    capture:
                                        targetCapture
                                            ?.capture ||
                                        null

                                }

                            };

                        }
                    );


            /*
             * --------------------------------------------------------
             * Return result
             * --------------------------------------------------------
             */

            return {

                generated:
                    true,


                sourceComponentCount:
                    sourceComponents.length,


                targetComponentCount:
                    targetComponents.length,


                matchedComponentCount:
                    finalMatches.length,


                matches:
                    finalMatches,


                missingInTarget:
                    matchingResult
                        .missingInTarget,


                extraInTarget:
                    matchingResult
                        .extraInTarget,


                timestamp:
                    new Date()
                        .toISOString()

            };

        }


        catch (error) {

            console.error(
                "Visual comparison failed:",
                error
            );


            return {

                generated:
                    false,

                error:
                    error.message ||
                    "Unknown visual comparison error",

                sourceComponentCount:
                    0,

                targetComponentCount:
                    0,

                matchedComponentCount:
                    0,

                matches:
                    [],

                missingInTarget:
                    [],

                extraInTarget:
                    []

            };

        }


        finally {

            /*
             * --------------------------------------------------------
             * Remove screenshot stabilization
             * --------------------------------------------------------
             */

            if (sourceTabId) {

                await removePageStabilization(
                    sourceTabId
                );

            }


            if (targetTabId) {

                await removePageStabilization(
                    targetTabId
                );

            }


            /*
             * --------------------------------------------------------
             * Restore original active tab
             * --------------------------------------------------------
             */

            if (originalActiveTabId) {

                try {

                    await chrome.tabs.update(
                        originalActiveTabId,
                        {
                            active: true
                        }
                    );

                }

                catch (error) {

                    console.warn(
                        "Could not restore original active tab:",
                        error
                    );

                }

            }

        }

    };



/* ============================================================
   COMPONENT DISCOVERY
   ============================================================ */

async function discoverVisualComponents(
    tabId
) {

    const executionResult =
        await chrome.scripting.executeScript({

            target: {
                tabId
            },

            func:
                discoverComponentsInsidePage,

            args: [
                {
                    maxComponents:
                        VISUAL_CONFIG.maxComponents,

                    minWidth:
                        VISUAL_CONFIG.minWidth,

                    minHeight:
                        VISUAL_CONFIG.minHeight
                }
            ]

        });


    if (
        !executionResult ||
        !executionResult.length
    ) {

        return [];

    }


    return (
        executionResult[0].result ||
        []
    );

}



/* ============================================================
   THIS FUNCTION RUNS INSIDE WEBSITE
   ============================================================ */

function discoverComponentsInsidePage(
    config
) {

    /*
     * ========================================================
     * BASIC HELPERS
     * ========================================================
     */

    function cleanText(
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
            .trim();

    }


    function normalize(
        value
    ) {

        return cleanText(
            value
        )
            .toLowerCase();

    }


    function isVisible(
        element
    ) {

        if (!element) {

            return false;

        }


        const style =
            window.getComputedStyle(
                element
            );


        if (
            style.display ===
                "none" ||

            style.visibility ===
                "hidden" ||

            Number(
                style.opacity
            ) === 0
        ) {

            return false;

        }


        const rect =
            element
                .getBoundingClientRect();


        if (
            rect.width <
                config.minWidth ||

            rect.height <
                config.minHeight
        ) {

            return false;

        }


        return true;

    }


    function containsUsefulContent(
        element
    ) {

        if (!element) {

            return false;

        }


        const text =
            cleanText(
                element.innerText
            );


        const hasImage =
            !!element.querySelector(
                "img, picture, video, svg"
            );


        const hasInteractive =
            !!element.querySelector(
                `
                a,
                button,
                input,
                select,
                textarea
                `
            );


        return (
            text.length >= 15 ||
            hasImage ||
            hasInteractive
        );

    }



    /*
     * ========================================================
     * STABLE CSS SELECTOR
     * ========================================================
     */

    function buildSelector(
        element
    ) {

        if (!element) {

            return "";

        }


        /*
         * ID is best.
         */

        if (
            element.id
        ) {

            try {

                const idSelector =
                    "#" +
                    CSS.escape(
                        element.id
                    );


                if (
                    document
                        .querySelectorAll(
                            idSelector
                        )
                        .length === 1
                ) {

                    return idSelector;

                }

            }

            catch {

                /*
                 * Ignore malformed ID.
                 */

            }

        }


        /*
         * Build an nth-of-type path.
         */

        const parts =
            [];


        let current =
            element;


        let depth =
            0;


        while (
            current &&
            current !==
                document.body &&
            depth < 7
        ) {

            let part =
                current.tagName
                    .toLowerCase();


            /*
             * Useful semantic attributes.
             */

            const role =
                current.getAttribute(
                    "role"
                );


            if (
                role
            ) {

                part +=
                    `[role="${CSS.escape(role)}"]`;

            }


            const cmp =
                current.getAttribute(
                    "data-cmp-is"
                );


            if (
                cmp
            ) {

                part +=
                    `[data-cmp-is="${CSS.escape(cmp)}"]`;

            }


            /*
             * nth-of-type keeps selector unique
             * when repeated components exist.
             */

            const parent =
                current.parentElement;


            if (
                parent
            ) {

                const siblings =
                    Array.from(
                        parent.children
                    )
                        .filter(
                            child =>
                                child.tagName ===
                                current.tagName
                        );


                if (
                    siblings.length > 1
                ) {

                    const index =
                        siblings.indexOf(
                            current
                        ) + 1;


                    part +=
                        `:nth-of-type(${index})`;

                }

            }


            parts.unshift(
                part
            );


            current =
                parent;


            depth++;

        }


        return parts.join(
            " > "
        );

    }



    /*
     * ========================================================
     * COMPONENT INFORMATION
     * ========================================================
     */

    function getHeading(
        element
    ) {

        const heading =
            element.querySelector(
                "h1, h2, h3, h4"
            );


        return cleanText(
            heading
                ?.innerText ||
            heading
                ?.textContent ||
            ""
        )
            .slice(
                0,
                120
            );

    }


    function getTextSignature(
        element
    ) {

        return cleanText(
            element.innerText
        )
            .slice(
                0,
                350
            );

    }


    function getComponentName(
        element,
        type,
        index
    ) {

        if (
            type ===
            "header"
        ) {

            return "Header";

        }


        if (
            type ===
            "footer"
        ) {

            return "Footer";

        }


        if (
            type ===
            "hero"
        ) {

            const heading =
                getHeading(
                    element
                );


            return (
                heading ||
                "Hero"
            );

        }


        const ariaLabel =
            cleanText(
                element.getAttribute(
                    "aria-label"
                )
            );


        if (
            ariaLabel
        ) {

            return ariaLabel;

        }


        const heading =
            getHeading(
                element
            );


        if (
            heading
        ) {

            return heading;

        }


        const cmpName =
            cleanText(
                element.getAttribute(
                    "data-cmp-is"
                )
            );


        if (
            cmpName
        ) {

            return (
                cmpName
                    .charAt(0)
                    .toUpperCase() +
                cmpName
                    .slice(1)
            );

        }


        return `Section ${index}`;

    }



    /*
     * ========================================================
     * DOCUMENT INFORMATION
     * ========================================================
     */

    const viewportWidth =
        window.innerWidth ||
        document.documentElement
            .clientWidth;


    const viewportHeight =
        window.innerHeight ||
        document.documentElement
            .clientHeight;


    const pageHeight =
        Math.max(

            document.body
                ?.scrollHeight ||
            0,

            document.documentElement
                ?.scrollHeight ||
            0

        );


    const main =
        document.querySelector(
            `
            main,
            [role="main"]
            `
        ) ||
        document.body;



    /*
     * ========================================================
     * COLLECT HEADER
     * ========================================================
     */

    const header =
        Array.from(
            document.querySelectorAll(
                `
                header,
                [role="banner"]
                `
            )
        )
            .find(
                element =>
                    isVisible(
                        element
                    )
            ) ||
        null;



    /*
     * ========================================================
     * COLLECT FOOTER
     * ========================================================
     */

    let footer =
        Array.from(
            document.querySelectorAll(
                `
                footer,
                [role="contentinfo"]
                `
            )
        )
            .find(
                element =>
                    isVisible(
                        element
                    )
            ) ||
        null;


    /*
     * AEM / custom footer fallback.
     */

    if (
        !footer
    ) {

        const footerFallbacks =
            Array.from(
                document.querySelectorAll(
                    `
                    [class*="footer" i],
                    [id*="footer" i],
                    [data-cmp-is*="footer" i]
                    `
                )
            )
                .filter(
                    element =>
                        isVisible(
                            element
                        )
                )
                .sort(
                    (
                        first,
                        second
                    ) =>

                        second
                            .getBoundingClientRect()
                            .top -

                        first
                            .getBoundingClientRect()
                            .top

                );


        if (
            footerFallbacks.length
        ) {

            footer =
                footerFallbacks[0];

        }

    }



    /*
     * ========================================================
     * CONTENT CANDIDATES
     * ========================================================
     */

    const candidateMap =
        new Map();



    function addCandidate(
        element,
        score,
        sourceType
    ) {

        if (
            !element ||
            element === main ||
            element === header ||
            element === footer
        ) {

            return;

        }


        if (
            !isVisible(
                element
            )
        ) {

            return;

        }


        if (
            !containsUsefulContent(
                element
            )
        ) {

            return;

        }


        const rect =
            element
                .getBoundingClientRect();


        /*
         * Avoid huge wrapper elements that represent
         * practically the whole page.
         */

        const absoluteHeight =
            rect.height;


        if (
            absoluteHeight >
                pageHeight * 0.8
        ) {

            return;

        }


        /*
         * Very narrow elements are usually inner widgets,
         * cards, buttons or columns rather than page sections.
         */

        if (
            rect.width <
                viewportWidth * 0.35
        ) {

            return;

        }


        /*
         * Generic DIV wrappers several screens tall are
         * usually layout containers.
         */

        if (
            sourceType ===
                "div" &&

            rect.height >
                viewportHeight * 2.3
        ) {

            return;

        }


        const existing =
            candidateMap.get(
                element
            );


        if (
            !existing ||
            score >
                existing.score
        ) {

            candidateMap.set(
                element,
                {
                    element,
                    score,
                    sourceType
                }
            );

        }

    }



    /*
     * --------------------------------------------------------
     * Strong semantic page sections
     * --------------------------------------------------------
     */

    Array.from(
        main.querySelectorAll(
            `
            section,
            article
            `
        )
    )
        .forEach(
            element => {

                addCandidate(
                    element,
                    100,
                    "semantic"
                );

            }
        );



    /*
     * --------------------------------------------------------
     * AEM components
     * --------------------------------------------------------
     */

    Array.from(
        main.querySelectorAll(
            "[data-cmp-is]"
        )
    )
        .forEach(
            element => {

                const cmp =
                    normalize(
                        element.getAttribute(
                            "data-cmp-is"
                        )
                    );


                /*
                 * Skip very small inner atomic components.
                 */

                const atomicComponents =
                    [
                        "button",
                        "text",
                        "title",
                        "image",
                        "separator",
                        "breadcrumb"
                    ];


                if (
                    atomicComponents.includes(
                        cmp
                    )
                ) {

                    return;

                }


                addCandidate(
                    element,
                    85,
                    "aem"
                );

            }
        );



    /*
     * --------------------------------------------------------
     * Direct children of MAIN
     * --------------------------------------------------------
     */

    Array.from(
        main.children ||
        []
    )
        .forEach(
            element => {

                addCandidate(
                    element,
                    90,
                    "main-child"
                );

            }
        );



    /*
     * --------------------------------------------------------
     * Common component wrappers
     * --------------------------------------------------------
     */

    Array.from(
        main.querySelectorAll(
            `
            .cmp-container,
            .container,
            [class*="component" i],
            [class*="section" i],
            [class*="hero" i],
            [class*="banner" i]
            `
        )
    )
        .forEach(
            element => {

                addCandidate(
                    element,
                    70,
                    "wrapper"
                );

            }
        );



    /*
     * --------------------------------------------------------
     * Generic DIV fallback
     *
     * Only examine DIVs relatively close to MAIN.
     * --------------------------------------------------------
     */

    const genericDivs =
        Array.from(
            main.querySelectorAll(
                "div"
            )
        );


    genericDivs.forEach(
        element => {

            /*
             * Determine depth from MAIN.
             */

            let depth =
                0;


            let current =
                element;


            while (
                current &&
                current !== main &&
                depth <= 4
            ) {

                current =
                    current.parentElement;

                depth++;

            }


            if (
                current !== main ||
                depth > 3
            ) {

                return;

            }


            addCandidate(
                element,
                50 - depth,
                "div"
            );

        }
    );



    /*
     * ========================================================
     * PREPARE CANDIDATE METADATA
     * ========================================================
     */

    let candidates =
        Array.from(
            candidateMap.values()
        )
            .map(
                candidate => {

                    const rect =
                        candidate.element
                            .getBoundingClientRect();


                    return {

                        ...candidate,

                        top:
                            rect.top +
                            window.scrollY,

                        left:
                            rect.left +
                            window.scrollX,

                        width:
                            rect.width,

                        height:
                            rect.height

                    };

                }
            );



    /*
     * ========================================================
     * REMOVE NEAR-DUPLICATE / OVERLAPPING WRAPPERS
     * ========================================================
     *
     * Pick stronger semantic components before weaker DIVs.
     */

    candidates.sort(
        (
            first,
            second
        ) => {

            if (
                second.score !==
                first.score
            ) {

                return (
                    second.score -
                    first.score
                );

            }


            return (
                first.height -
                second.height
            );

        }
    );


    const selected =
        [];


    function verticalOverlapRatio(
        first,
        second
    ) {

        const firstBottom =
            first.top +
            first.height;


        const secondBottom =
            second.top +
            second.height;


        const overlap =
            Math.max(
                0,

                Math.min(
                    firstBottom,
                    secondBottom
                ) -

                Math.max(
                    first.top,
                    second.top
                )
            );


        const smallerHeight =
            Math.min(
                first.height,
                second.height
            );


        if (
            smallerHeight <= 0
        ) {

            return 0;

        }


        return (
            overlap /
            smallerHeight
        );

    }


    for (
        const candidate of candidates
    ) {

        const duplicate =
            selected.some(
                chosen => {

                    const overlap =
                        verticalOverlapRatio(
                            candidate,
                            chosen
                        );


                    /*
                     * Heavy vertical overlap + similar width
                     * normally means one is just a wrapper
                     * around the other.
                     */

                    const widthRatio =
                        Math.min(
                            candidate.width,
                            chosen.width
                        ) /
                        Math.max(
                            candidate.width,
                            chosen.width
                        );


                    return (
                        overlap >= 0.82 &&
                        widthRatio >= 0.65
                    );

                }
            );


        if (
            duplicate
        ) {

            continue;

        }


        selected.push(
            candidate
        );

    }



    /*
     * ========================================================
     * SORT CONTENT TOP TO BOTTOM
     * ========================================================
     */

    selected.sort(
        (
            first,
            second
        ) =>

            first.top -
            second.top

    );



    /*
     * ========================================================
     * REMOVE ELEMENTS INSIDE HEADER / FOOTER REGIONS
     * ========================================================
     */

    let filteredContent =
        selected.filter(
            candidate => {

                if (
                    header &&
                    header.contains(
                        candidate.element
                    )
                ) {

                    return false;

                }


                if (
                    footer &&
                    footer.contains(
                        candidate.element
                    )
                ) {

                    return false;

                }


                return true;

            }
        );



    /*
     * ========================================================
     * COMPONENT LIMIT
     * ========================================================
     *
     * Reserve:
     *
     * 1 Header
     * 1 Footer
     *
     * when available.
     */

    const reservedCount =
        (
            header
                ? 1
                : 0
        ) +
        (
            footer
                ? 1
                : 0
        );


    const availableContentSlots =
        Math.max(
            1,

            config.maxComponents -
            reservedCount
        );


    filteredContent =
        filteredContent.slice(
            0,
            availableContentSlots
        );



    /*
     * ========================================================
     * BUILD FINAL COMPONENT LIST
     * ========================================================
     */

    const finalComponents =
        [];


    let uidCounter =
        1;



function createComponent(
    element,
    type,
    order,
    index
) {

    const rect =
        element
            .getBoundingClientRect();


    const id =
        cleanText(
            element.id
        );


    const ariaLabel =
        cleanText(
            element.getAttribute(
                "aria-label"
            )
        );


    const heading =
        getHeading(
            element
        );


    const name =
        getComponentName(
            element,
            type,
            index
        );


    /*
     * Create a stable EnvCompare marker.
     *
     * This is more reliable than using
     * nth-of-type CSS selectors because
     * AEM/lazy-loaded DOM can change later.
     */

    const visualId =
        `envcompare-${uidCounter}`;


    element.setAttribute(
        "data-envcompare-visual-id",
        visualId
    );


    const cmp =
        cleanText(
            element.getAttribute(
                "data-cmp-is"
            )
        );


    return {

        uid:
            `visual-${uidCounter++}`,

        type,

        name,

        normalizedName:
            normalize(
                name
            ),

        tagName:
            element.tagName,

        id,

        role:
            cleanText(
                element.getAttribute(
                    "role"
                )
            ),

        ariaLabel,

        heading,

        cmpType:
            cmp,

        textSignature:
            getTextSignature(
                element
            ),

        /*
         * Stable selector for later scrolling/capture.
         */

        selector:
            `[data-envcompare-visual-id="${visualId}"]`,

        order,

        initialRect: {

            width:
                Math.round(
                    rect.width
                ),

            height:
                Math.round(
                    rect.height
                )

        }

    };

}



    /*
     * HEADER
     */

    if (
        header
    ) {

        finalComponents.push(
            createComponent(
                header,
                "header",
                finalComponents.length,
                0
            )
        );

    }



    /*
     * CONTENT
     */

    filteredContent.forEach(
        (
            candidate,
            index
        ) => {

            /*
             * First meaningful content region
             * is treated as HERO.
             */

            const type =
                index === 0
                    ? "hero"
                    : "section";


            finalComponents.push(
                createComponent(
                    candidate.element,
                    type,
                    finalComponents.length,
                    index + 1
                )
            );

        }
    );



    /*
     * FOOTER
     */

    if (
        footer &&
        finalComponents.length <
            config.maxComponents
    ) {

        finalComponents.push(
            createComponent(
                footer,
                "footer",
                finalComponents.length,
                finalComponents.length
            )
        );

    }



    /*
     * Ensure hard max.
     */

    return finalComponents.slice(
        0,
        config.maxComponents
    );

}



/* ============================================================
   COMPONENT MATCHING
   ============================================================ */

function matchVisualComponents(
    sourceComponents,
    targetComponents
) {

    const matches =
        [];


    const usedTargetUids =
        new Set();



    for (
        const source of sourceComponents
    ) {

        let bestTarget =
            null;


        let bestScore =
            Number.NEGATIVE_INFINITY;


        for (
            const target of targetComponents
        ) {

            if (
                usedTargetUids.has(
                    target.uid
                )
            ) {

                continue;

            }


            const score =
                calculateComponentMatchScore(
                    source,
                    target
                );


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;


                bestTarget =
                    target;

            }

        }


        /*
         * Require a minimum confidence.
         */

        if (
            bestTarget &&
            bestScore >= 30
        ) {

            matches.push({

                source,

                target:
                    bestTarget,

                matchScore:
                    Math.round(
                        bestScore *
                        100
                    ) / 100

            });


            usedTargetUids.add(
                bestTarget.uid
            );

        }

    }



    const matchedSourceIds =
        new Set(
            matches.map(
                item =>
                    item.source.uid
            )
        );


    const missingInTarget =
        sourceComponents
            .filter(
                item =>
                    !matchedSourceIds.has(
                        item.uid
                    )
            );


    const extraInTarget =
        targetComponents
            .filter(
                item =>
                    !usedTargetUids.has(
                        item.uid
                    )
            );


    return {

        matches,

        missingInTarget,

        extraInTarget

    };

}



/* ============================================================
   COMPONENT MATCH SCORE
   ============================================================ */

function calculateComponentMatchScore(
    source,
    target
) {

    let score =
        0;



    /*
     * Same semantic type.
     */

    if (
        source.type ===
        target.type
    ) {

        score +=
            40;

    }



    /*
     * IDs are extremely strong matches.
     */

    if (
        source.id &&
        target.id &&
        normalizeMatchingText(
            source.id
        ) ===
        normalizeMatchingText(
            target.id
        )
    ) {

        score +=
            100;

    }



    /*
     * ARIA label.
     */

    if (
        source.ariaLabel &&
        target.ariaLabel &&
        normalizeMatchingText(
            source.ariaLabel
        ) ===
        normalizeMatchingText(
            target.ariaLabel
        )
    ) {

        score +=
            80;

    }



    /*
     * Heading.
     */

    if (
        source.heading &&
        target.heading
    ) {

        if (
            normalizeMatchingText(
                source.heading
            ) ===
            normalizeMatchingText(
                target.heading
            )
        ) {

            score +=
                75;

        }

        else {

            score +=
                textSimilarity(
                    source.heading,
                    target.heading
                ) * 35;

        }

    }



    /*
     * Display name.
     */

    if (
        source.normalizedName &&
        target.normalizedName &&
        source.normalizedName ===
        target.normalizedName
    ) {

        score +=
            60;

    }



    /*
     * AEM component type.
     */

    if (
        source.cmpType &&
        target.cmpType &&
        normalizeMatchingText(
            source.cmpType
        ) ===
        normalizeMatchingText(
            target.cmpType
        )
    ) {

        score +=
            45;

    }



    /*
     * Text similarity.
     */

    score +=

        textSimilarity(
            source.textSignature,
            target.textSignature
        ) * 30;



    /*
     * Similar dimensions are a useful clue.
     */

    const sourceWidth =
        source.initialRect
            ?.width ||
        0;


    const targetWidth =
        target.initialRect
            ?.width ||
        0;


    if (
        sourceWidth &&
        targetWidth
    ) {

        const widthRatio =
            Math.min(
                sourceWidth,
                targetWidth
            ) /
            Math.max(
                sourceWidth,
                targetWidth
            );


        score +=
            widthRatio * 10;

    }



    /*
     * Order difference penalty.
     */

    const orderDifference =
        Math.abs(
            (
                source.order ||
                0
            ) -
            (
                target.order ||
                0
            )
        );


    score -=
        orderDifference * 5;


    return score;

}



/* ============================================================
   TEXT SIMILARITY
   ============================================================ */

function textSimilarity(
    firstText,
    secondText
) {

    const first =
        tokenizeText(
            firstText
        );


    const second =
        tokenizeText(
            secondText
        );


    if (
        first.size === 0 &&
        second.size === 0
    ) {

        return 1;

    }


    if (
        first.size === 0 ||
        second.size === 0
    ) {

        return 0;

    }


    let intersection =
        0;


    first.forEach(
        word => {

            if (
                second.has(
                    word
                )
            ) {

                intersection++;

            }

        }
    );


    const union =
        new Set([
            ...first,
            ...second
        ])
            .size;


    if (
        union === 0
    ) {

        return 0;

    }


    return (
        intersection /
        union
    );

}



function tokenizeText(
    value
) {

    const normalized =
        normalizeMatchingText(
            value
        );


    return new Set(

        normalized
            .split(
                /\s+/
            )
            .filter(
                word =>
                    word.length >= 3
            )

    );

}



function normalizeMatchingText(
    value
) {

    return String(
        value ||
        ""
    )
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}



/* ============================================================
   CAPTURE COMPONENT COLLECTION
   ============================================================ */

async function captureComponents(
    tabId,
    windowId,
    components
) {

    const captures =
        [];


    /*
     * Tab must be active because
     * captureVisibleTab captures active tab.
     */

    await chrome.tabs.update(
        tabId,
        {
            active: true
        }
    );


    /*
     * Install temporary CSS that makes
     * screenshots more deterministic.
     */

    await applyPageStabilization(
        tabId
    );


    await sleepVisual(
        300
    );


    for (
        const component of components
    ) {

        try {

            console.log(
                "Capturing visual component:",
                component.name
            );


            /*
             * --------------------------------------------------------
             * STEP 1
             * Scroll element into view
             * --------------------------------------------------------
             */

            const scrollResult =
                await chrome.scripting
                    .executeScript({

                        target: {
                            tabId
                        },

                        func:
                            scrollComponentIntoView,

                        args: [
                            component.selector
                        ]

                    });


            const found =
                scrollResult?.[0]
                    ?.result
                    ?.found;


            if (
                !found
            ) {

                console.warn(
                    "Component selector no longer available:",
                    component.selector
                );


                captures.push({

                    uid:
                        component.uid,

                    capture:
                        null

                });


                continue;

            }


            /*
             * --------------------------------------------------------
             * STEP 2
             * Allow page to settle
             * --------------------------------------------------------
             */

            await sleepVisual(
                VISUAL_CONFIG
                    .settleAfterScrollMs
            );


            /*
             * --------------------------------------------------------
             * STEP 3
             * Recalculate element rectangle AFTER settling.
             *
             * This is important for sticky headers,
             * lazy loading and AEM layout movement.
             * --------------------------------------------------------
             */

            const rectResult =
                await chrome.scripting
                    .executeScript({

                        target: {
                            tabId
                        },

                        func:
                            measureComponentForCapture,

                        args: [
                            component.selector
                        ]

                    });


            const measurement =
                rectResult?.[0]
                    ?.result;


            if (
                !measurement ||
                !measurement.found ||
                !measurement.crop ||
                measurement.crop.width <= 0 ||
                measurement.crop.height <= 0
            ) {

                console.warn(
                    "Unable to measure component:",
                    component.name
                );


                captures.push({

                    uid:
                        component.uid,

                    capture:
                        null

                });


                continue;

            }


            /*
             * --------------------------------------------------------
             * STEP 4
             * Capture current visible tab
             * --------------------------------------------------------
             */

            const image =
    await captureVisibleTabWithRetry(
        windowId,
                        {

                            format:
                                "jpeg",

                            quality:
                                VISUAL_CONFIG
                                    .jpegQuality

                        }
                    );


            captures.push({

                uid:
                    component.uid,


                capture: {

                    image,


                    crop:
                        measurement.crop,


                    viewport:
                        measurement.viewport,


                    original:
                        measurement.original,


                    clipped:
                        measurement.clipped,


                    scrollY:
                        measurement.scrollY

                }

            });


            /*
             * Avoid screenshot rate limit.
             */

            await sleepVisual(
                VISUAL_CONFIG
                    .captureDelayMs
            );

        }


        catch (error) {

            console.warn(
                `Capture failed for ${component.name}:`,
                error
            );


            captures.push({

                uid:
                    component.uid,

                capture:
                    null

            });


            /*
             * Still respect capture interval.
             */

            await sleepVisual(
                VISUAL_CONFIG
                    .captureDelayMs
            );

        }

    }


    return captures;

}



/* ============================================================
   SCROLL COMPONENT
   Runs inside website
   ============================================================ */

function scrollComponentIntoView(
    selector
) {

    try {

        const element =
            document.querySelector(
                selector
            );


        if (
            !element
        ) {

            return {
                found: false
            };

        }


        element.scrollIntoView({

            behavior:
                "auto",

            /*
             * Center works better than "start"
             * when sites have sticky headers.
             */

            block:
                "center",

            inline:
                "nearest"

        });


        return {
            found: true
        };

    }


    catch (error) {

        return {

            found:
                false,

            error:
                error.message

        };

    }

}



/* ============================================================
   MEASURE COMPONENT AFTER SCROLL
   Runs inside website
   ============================================================ */

function measureComponentForCapture(
    selector
) {

    try {

        const element =
            document.querySelector(
                selector
            );


        if (
            !element
        ) {

            return {
                found: false
            };

        }


        const rect =
            element
                .getBoundingClientRect();


        const viewportWidth =
            window.innerWidth ||
            document.documentElement
                .clientWidth;


        const viewportHeight =
            window.innerHeight ||
            document.documentElement
                .clientHeight;


        /*
         * Only the portion actually visible in viewport
         * can be captured using captureVisibleTab.
         */

        const left =
            Math.max(
                0,
                rect.left
            );


        const top =
            Math.max(
                0,
                rect.top
            );


        const right =
            Math.min(
                viewportWidth,
                rect.right
            );


        const bottom =
            Math.min(
                viewportHeight,
                rect.bottom
            );


        const width =
            Math.max(
                0,
                right - left
            );


        const height =
            Math.max(
                0,
                bottom - top
            );


        const clipped =
            (
                rect.left < 0 ||
                rect.top < 0 ||
                rect.right >
                    viewportWidth ||
                rect.bottom >
                    viewportHeight
            );


        return {

            found:
                true,


            crop: {

                x:
                    Math.round(
                        left
                    ),

                y:
                    Math.round(
                        top
                    ),

                width:
                    Math.round(
                        width
                    ),

                height:
                    Math.round(
                        height
                    )

            },


            viewport: {

                width:
                    viewportWidth,

                height:
                    viewportHeight

            },


            original: {

                width:
                    Math.round(
                        rect.width
                    ),

                height:
                    Math.round(
                        rect.height
                    )

            },


            clipped,


            scrollY:
                window.scrollY

        };

    }


    catch (error) {

        return {

            found:
                false,

            error:
                error.message

        };

    }

}



/* ============================================================
   SCREENSHOT STABILIZATION
   ============================================================ */

async function applyPageStabilization(
    tabId
) {

    try {

        await chrome.scripting
            .executeScript({

                target: {
                    tabId
                },

                func:
                    installVisualCaptureStyles

            });

    }


    catch (error) {

        console.warn(
            "Could not apply visual stabilization:",
            error
        );

    }

}



/* ============================================================
   RUNS INSIDE WEBSITE
   ============================================================ */

function installVisualCaptureStyles() {

    const STYLE_ID =
        "__envcompare_visual_capture_style";


    /*
     * Remove old one first.
     */

    document
        .getElementById(
            STYLE_ID
        )
        ?.remove();


    const style =
        document.createElement(
            "style"
        );


    style.id =
        STYLE_ID;


    style.textContent = `

        html {
            scroll-behavior:
                auto !important;
        }

        *,
        *::before,
        *::after {

            animation:
                none !important;

            animation-delay:
                0s !important;

            animation-duration:
                0s !important;

            transition:
                none !important;

            transition-delay:
                0s !important;

            transition-duration:
                0s !important;

            caret-color:
                transparent !important;

        }

    `;


    document.documentElement
        .appendChild(
            style
        );


    /*
     * Pause playing HTML5 video where possible.
     */

    document
        .querySelectorAll(
            "video"
        )
        .forEach(
            video => {

                try {

                    video.pause();

                }

                catch {

                    /*
                     * Ignore video restrictions.
                     */

                }

            }
        );

}



/* ============================================================
   REMOVE STABILIZATION
   ============================================================ */

async function removePageStabilization(
    tabId
) {

    try {

        await chrome.scripting
            .executeScript({

                target: {
                    tabId
                },

                func:
                    removeVisualCaptureStyles

            });

    }


    catch {

        /*
         * Page/tab may already be unavailable.
         */

    }

}



/* ============================================================
   RUNS INSIDE WEBSITE
   ============================================================ */

function removeVisualCaptureStyles() {

    document
        .getElementById(
            "__envcompare_visual_capture_style"
        )
        ?.remove();

}



/* ============================================================
   DISPLAY NAME FOR MATCHED PAIR
   ============================================================ */

function choosePairName(
    source,
    target
) {

    /*
     * Prefer meaningful source name.
     */

    if (
        source.name &&
        !/^section \d+$/i.test(
            source.name
        )
    ) {

        return source.name;

    }


    if (
        target.name &&
        !/^section \d+$/i.test(
            target.name
        )
    ) {

        return target.name;

    }


    if (
        source.type ===
        "header"
    ) {

        return "Header";

    }


    if (
        source.type ===
        "footer"
    ) {

        return "Footer";

    }


    if (
        source.type ===
        "hero"
    ) {

        return (
            source.heading ||
            target.heading ||
            "Hero"
        );

    }


    return (
        source.name ||
        target.name ||
        "Page Section"
    );

}

async function captureVisibleTabWithRetry(
    windowId
) {

    const maxAttempts =
        3;


    let lastError =
        null;


    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        try {

            /*
             * Small wait before every capture.
             */

            await sleepVisual(
                400
            );


            const image =
                await chrome.tabs
                    .captureVisibleTab(
                        windowId,
                        {

                            format:
                                "jpeg",

                            quality:
                                VISUAL_CONFIG
                                    .jpegQuality

                        }
                    );


            if (
                image
            ) {

                return image;

            }

        }

        catch (error) {

            lastError =
                error;


            console.warn(
                `Screenshot attempt ${attempt} failed:`,
                error
            );

        }


        /*
         * Give browser extra recovery time
         * before another screenshot attempt.
         */

        await sleepVisual(
            1000
        );

    }


    throw (
        lastError ||
        new Error(
            "Unable to capture visible tab."
        )
    );

}

/* ============================================================
   DISMISS ONETRUST COOKIE BANNER
   ============================================================ */

async function dismissOneTrustBanner(
    tabId
) {

    try {

        const result =
            await chrome.scripting.executeScript({

                target: {
                    tabId
                },

                func: () => {

                    const acceptButton =
                        document.querySelector(
                            "#onetrust-accept-btn-handler"
                        );


                    if (
                        acceptButton
                    ) {

                        acceptButton.click();


                        return {
                            dismissed: true
                        };

                    }


                    return {
                        dismissed: false
                    };

                }

            });


        const dismissed =
            result?.[0]
                ?.result
                ?.dismissed;


        if (
            dismissed
        ) {

            console.log(
                "EnvCompare: OneTrust cookie banner dismissed."
            );


            /*
             * Give OneTrust time to remove
             * banner + overlay from DOM.
             */

            await sleepVisual(
                800
            );

        }

    }

    catch (error) {

        console.warn(
            "Unable to dismiss OneTrust banner:",
            error
        );

    }

}


/* ============================================================
   SLEEP
   ============================================================ */

function sleepVisual(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}