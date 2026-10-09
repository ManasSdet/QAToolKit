(() => {

    const PIXEL_TOLERANCE = 35;


    document.addEventListener(
        "DOMContentLoaded",
        loadVisualComparison
    );


    async function loadVisualComparison() {

        const container =
            document.getElementById(
                "visualComparison"
            );

        if (!container) {
            return;
        }


        try {

            const storage =
                await chrome.storage.local.get(
                    "comparisonResult"
                );


            const result =
                storage.comparisonResult;


            const visual =
                result?.visualComparison;


            if (!visual) {

                container.innerHTML = `
                    <div class="visual-empty">
                        Visual comparison information is unavailable.
                    </div>
                `;

                return;
            }


            if (!visual.generated) {

                container.innerHTML = `
                    <div class="visual-error">
                        Visual comparison failed:
                        ${escapeHtml(
                            visual.error ||
                            "Unknown error"
                        )}
                    </div>
                `;

                return;
            }


            await renderVisualComparison(
                visual,
                container
            );


        } catch (error) {

            console.error(
                "Visual rendering failed:",
                error
            );

            container.innerHTML = `
                <div class="visual-error">
                    Unable to render visual comparison:
                    ${escapeHtml(error.message)}
                </div>
            `;

        }

    }


    async function renderVisualComparison(
        visual,
        container
    ) {

        container.innerHTML = "";


        const processedResults = [];


        for (
            const pair of visual.matches || []
        ) {

            if (
                !pair.source?.capture ||
                !pair.target?.capture
            ) {

                processedResults.push({
                    ...pair,

                    comparisonAvailable:
                        false
                });

                continue;
            }


            try {

                const comparison =
                    await compareComponentPair(
                        pair.source.capture,
                        pair.target.capture
                    );


                processedResults.push({
                    ...pair,
                    ...comparison,

                    comparisonAvailable:
                        true
                });


            } catch (error) {

                console.warn(
                    `Could not compare ${pair.name}`,
                    error
                );


                processedResults.push({
                    ...pair,

                    comparisonAvailable:
                        false,

                    error:
                        error.message
                });

            }

        }


        /*
         * ============================================================
         * OVERALL SCORE
         * ============================================================
         */

        let totalWeightedScore = 0;
        let totalArea = 0;


        processedResults.forEach(item => {

            if (
                !item.comparisonAvailable
            ) {
                return;
            }


            const area =
                item.comparisonArea || 1;


            totalWeightedScore +=
                item.similarityPercentage *
                area;


            totalArea += area;

        });


        let overallSimilarity =
            totalArea > 0
                ? totalWeightedScore /
                  totalArea
                : 0;


        /*
         * Missing/extra components reduce overall confidence.
         */

        const unmatchedCount =
            (visual.missingInTarget?.length || 0) +
            (visual.extraInTarget?.length || 0);


        if (unmatchedCount > 0) {

            const totalLogicalComponents =
                processedResults.length +
                unmatchedCount;


            if (totalLogicalComponents > 0) {

                const componentCoverage =
                    processedResults.length /
                    totalLogicalComponents;


                overallSimilarity *=
                    componentCoverage;

            }

        }


        overallSimilarity =
            roundTwo(
                overallSimilarity
            );


        const overallStatus =
            getVisualStatus(
                overallSimilarity
            );


        /*
         * ============================================================
         * SUMMARY
         * ============================================================
         */

        const summary =
            document.createElement("div");

        summary.className =
            "visual-summary";


        summary.innerHTML = `

            <div class="visual-score-card">

                <div class="visual-score-label">
                    Overall Visual Match
                </div>

                <div class="
                    visual-score
                    ${overallStatus.className}
                ">
                    ${overallSimilarity}%
                </div>

                <div class="
                    visual-score-status
                    ${overallStatus.className}
                ">
                    ${overallStatus.label}
                </div>

            </div>


            <div class="visual-stats">

                <div class="visual-stat">
                    <span>Source Components</span>
                    <strong>
                        ${visual.sourceComponentCount || 0}
                    </strong>
                </div>

                <div class="visual-stat">
                    <span>Target Components</span>
                    <strong>
                        ${visual.targetComponentCount || 0}
                    </strong>
                </div>

                <div class="visual-stat">
                    <span>Compared</span>
                    <strong>
                        ${
                            processedResults
                                .filter(
                                    item =>
                                        item.comparisonAvailable
                                )
                                .length
                        }
                    </strong>
                </div>

                <div class="visual-stat">
                    <span>Missing in Target</span>
                    <strong class="${
                        visual.missingInTarget?.length
                            ? "danger-text"
                            : ""
                    }">
                        ${
                            visual.missingInTarget
                                ?.length || 0
                        }
                    </strong>
                </div>

                <div class="visual-stat">
                    <span>Extra in Target</span>
                    <strong class="${
                        visual.extraInTarget?.length
                            ? "warning-text"
                            : ""
                    }">
                        ${
                            visual.extraInTarget
                                ?.length || 0
                        }
                    </strong>
                </div>

            </div>
        `;


        container.appendChild(summary);


        /*
         * ============================================================
         * COMPONENT SUMMARY TABLE
         * ============================================================
         */

        const componentSummary =
            document.createElement("div");


        componentSummary.className =
            "visual-component-table-wrapper";


        componentSummary.innerHTML = `

            <table class="visual-component-table">

                <thead>
                    <tr>
                        <th>Component</th>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Visual Match</th>
                        <th>Status</th>
                    </tr>
                </thead>

                <tbody>

                    ${
                        processedResults
                            .map(
                                item =>
                                    buildSummaryRow(item)
                            )
                            .join("")
                    }

                </tbody>

            </table>

        `;


        container.appendChild(
            componentSummary
        );


        /*
         * ============================================================
         * MISSING / EXTRA COMPONENTS
         * ============================================================
         */

        renderUnmatchedComponents(
            container,
            visual
        );


        /*
         * ============================================================
         * DETAILED IMAGE COMPARISON
         * ============================================================
         */

        const details =
            document.createElement("div");

        details.className =
            "visual-details";


        for (
            const item of processedResults
        ) {

            details.appendChild(
                buildVisualCard(item)
            );

        }


        container.appendChild(
            details
        );

    }


    /*
     * ================================================================
     * PIXEL COMPARISON
     * ================================================================
     */

    async function compareComponentPair(
        sourceCapture,
        targetCapture
    ) {

        const sourceCrop =
            await cropScreenshot(
                sourceCapture
            );


        const targetCrop =
            await cropScreenshot(
                targetCapture
            );


        const sourceImage =
            sourceCrop.image;

        const targetImage =
            targetCrop.image;


        /*
         * Use larger size.
         * This allows missing height/width to count as difference.
         */

        let width =
            Math.max(
                sourceImage.width,
                targetImage.width
            );


        let height =
            Math.max(
                sourceImage.height,
                targetImage.height
            );


        /*
         * Protect report from very expensive image comparison.
         */

        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 900;


        const scale =
            Math.min(
                1,
                MAX_WIDTH / width,
                MAX_HEIGHT / height
            );


        width =
            Math.max(
                1,
                Math.round(
                    width * scale
                )
            );


        height =
            Math.max(
                1,
                Math.round(
                    height * scale
                )
            );


        const sourceCanvas =
            createCanvas(
                width,
                height
            );


        const targetCanvas =
            createCanvas(
                width,
                height
            );


        const sourceContext =
            sourceCanvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );


        const targetContext =
            targetCanvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );


        /*
         * White background means different component sizes
         * become visible in the comparison.
         */

        sourceContext.fillStyle =
            "#ffffff";

        sourceContext.fillRect(
            0,
            0,
            width,
            height
        );


        targetContext.fillStyle =
            "#ffffff";

        targetContext.fillRect(
            0,
            0,
            width,
            height
        );


        sourceContext.drawImage(
            sourceImage,
            0,
            0,

            Math.round(
                sourceImage.width *
                scale
            ),

            Math.round(
                sourceImage.height *
                scale
            )
        );


        targetContext.drawImage(
            targetImage,
            0,
            0,

            Math.round(
                targetImage.width *
                scale
            ),

            Math.round(
                targetImage.height *
                scale
            )
        );


        const sourceData =
            sourceContext.getImageData(
                0,
                0,
                width,
                height
            );


        const targetData =
            targetContext.getImageData(
                0,
                0,
                width,
                height
            );


        const diffCanvas =
            createCanvas(
                width,
                height
            );


        const diffContext =
            diffCanvas.getContext(
                "2d"
            );


        const diffData =
            diffContext.createImageData(
                width,
                height
            );


        let differentPixels = 0;


        for (
            let i = 0;
            i < sourceData.data.length;
            i += 4
        ) {

            const redDifference =
                Math.abs(
                    sourceData.data[i] -
                    targetData.data[i]
                );


            const greenDifference =
                Math.abs(
                    sourceData.data[i + 1] -
                    targetData.data[i + 1]
                );


            const blueDifference =
                Math.abs(
                    sourceData.data[i + 2] -
                    targetData.data[i + 2]
                );


            const maximumDifference =
                Math.max(
                    redDifference,
                    greenDifference,
                    blueDifference
                );


            if (
                maximumDifference >
                PIXEL_TOLERANCE
            ) {

                differentPixels++;


                diffData.data[i] =
                    235;

                diffData.data[i + 1] =
                    55;

                diffData.data[i + 2] =
                    55;

                diffData.data[i + 3] =
                    210;

            } else {

                /*
                 * Matching pixels stay faint grey in diff image.
                 */

                const grey =
                    Math.round(
                        (
                            sourceData.data[i] +
                            sourceData.data[i + 1] +
                            sourceData.data[i + 2]
                        ) / 3
                    );


                diffData.data[i] =
                    grey;

                diffData.data[i + 1] =
                    grey;

                diffData.data[i + 2] =
                    grey;

                diffData.data[i + 3] =
                    45;

            }

        }


        diffContext.putImageData(
            diffData,
            0,
            0
        );


        const totalPixels =
            width *
            height;


        const mismatchPercentage =
            totalPixels > 0

                ? (
                    differentPixels /
                    totalPixels
                  ) * 100

                : 0;


        const similarityPercentage =
            100 -
            mismatchPercentage;


        return {

            similarityPercentage:
                roundTwo(
                    similarityPercentage
                ),

            mismatchPercentage:
                roundTwo(
                    mismatchPercentage
                ),

            comparisonArea:
                totalPixels,

            sourceImage:
                sourceCrop.dataUrl,

            targetImage:
                targetCrop.dataUrl,

            diffImage:
                diffCanvas.toDataURL(
                    "image/png"
                ),

            sourceClipped:
                sourceCapture.clipped,

            targetClipped:
                targetCapture.clipped

        };

    }


    /*
     * ================================================================
     * CROP SCREENSHOT TO COMPONENT
     * ================================================================
     */

    async function cropScreenshot(
        capture
    ) {

        const screenshot =
            await loadImage(
                capture.image
            );


        /*
         * Screenshot pixels can differ from CSS pixels
         * because of Windows DPI / browser zoom.
         */

        const scaleX =
            screenshot.naturalWidth /
            capture.viewport.width;


        const scaleY =
            screenshot.naturalHeight /
            capture.viewport.height;


        const sx =
            Math.round(
                capture.crop.x *
                scaleX
            );


        const sy =
            Math.round(
                capture.crop.y *
                scaleY
            );


        const sw =
            Math.max(
                1,
                Math.round(
                    capture.crop.width *
                    scaleX
                )
            );


        const sh =
            Math.max(
                1,
                Math.round(
                    capture.crop.height *
                    scaleY
                )
            );


        const canvas =
            createCanvas(
                sw,
                sh
            );


        const context =
            canvas.getContext(
                "2d"
            );


        context.drawImage(
            screenshot,

            sx,
            sy,
            sw,
            sh,

            0,
            0,
            sw,
            sh
        );


        const dataUrl =
            canvas.toDataURL(
                "image/jpeg",
                0.82
            );


        const image =
            await loadImage(
                dataUrl
            );


        return {

            dataUrl,

            image

        };

    }


    /*
     * ================================================================
     * SUMMARY ROW
     * ================================================================
     */

    function buildSummaryRow(item) {

       if (
    !item.comparisonAvailable
) {

    const sourceStatus =
        item.source?.capture
            ? "Captured"
            : "Capture failed";


    const targetStatus =
        item.target?.capture
            ? "Captured"
            : "Capture failed";


    return `
        <tr>

            <td>
                <strong>
                    ${escapeHtml(item.name)}
                </strong>
            </td>

            <td>
                ${sourceStatus}
            </td>

            <td>
                ${targetStatus}
            </td>

            <td>
                -
            </td>

            <td>

                <span class="
                    visual-result-badge
                    visual-unavailable
                ">
                    Not compared
                </span>

            </td>

        </tr>
    `;

}

    }


    /*
     * ================================================================
     * VISUAL DETAIL CARD
     * ================================================================
     */

    function buildVisualCard(item) {

        const card =
            document.createElement(
                "div"
            );


        card.className =
            "visual-component-card";


        if (
            !item.comparisonAvailable
        ) {

            card.innerHTML = `

                <div class="visual-component-header">

                    <div>

                        <h3>
                            ${escapeHtml(item.name)}
                        </h3>

                        <p>
                            Screenshot comparison unavailable
                        </p>

                    </div>

                </div>

            `;


            return card;

        }


        const status =
            getVisualStatus(
                item.similarityPercentage
            );


        card.innerHTML = `

            <div class="visual-component-header">

                <div>

                    <h3>
                        ${escapeHtml(item.name)}
                    </h3>

                    <p>
                        ${escapeHtml(
                            item.type ||
                            "component"
                        )}
                    </p>

                </div>


                <div class="visual-component-score">

                    <strong class="
                        ${status.className}
                    ">
                        ${item.similarityPercentage}%
                    </strong>

                    <span>
                        match
                    </span>

                </div>

            </div>


            ${
                (
                    item.sourceClipped ||
                    item.targetClipped
                )

                ? `

                    <div class="visual-clip-note">

                        This component is larger than the available viewport.
                        EnvCompare compared the visible component area.

                    </div>

                `

                : ""
            }


            <div class="visual-image-grid">


                <div class="visual-image-panel">

                    <div class="visual-image-title">
                        SOURCE
                    </div>

                    <img
                        src="${item.sourceImage}"
                        alt="Source component"
                    >

                </div>


                <div class="visual-image-panel">

                    <div class="visual-image-title">
                        TARGET
                    </div>

                    <img
                        src="${item.targetImage}"
                        alt="Target component"
                    >

                </div>


                <div class="
                    visual-image-panel
                    visual-diff-panel
                ">

                    <div class="visual-image-title">
                        DIFFERENCE
                    </div>

                    <img
                        src="${item.diffImage}"
                        alt="Visual difference"
                    >

                </div>


            </div>


            <div class="visual-component-footer">

                <span>

                    Mismatch:

                    <strong>
                        ${item.mismatchPercentage}%
                    </strong>

                </span>


                <span class="
                    ${status.className}
                ">

                    ${status.label}

                </span>

            </div>

        `;


        return card;

    }


    /*
     * ================================================================
     * MISSING / EXTRA COMPONENTS
     * ================================================================
     */

    function renderUnmatchedComponents(
        container,
        visual
    ) {

        const missing =
            visual.missingInTarget ||
            [];


        const extra =
            visual.extraInTarget ||
            [];


        if (
            missing.length === 0 &&
            extra.length === 0
        ) {

            return;

        }


        const section =
            document.createElement(
                "div"
            );


        section.className =
            "visual-unmatched";


        section.innerHTML = `

            ${
                missing.length

                ? `

                    <div class="visual-unmatched-card">

                        <h4>
                            Missing in Target
                        </h4>

                        <ul>

                            ${
                                missing
                                    .map(
                                        item => `
                                            <li>
                                                ${escapeHtml(
                                                    item.name
                                                )}
                                            </li>
                                        `
                                    )
                                    .join("")
                            }

                        </ul>

                    </div>

                `

                : ""
            }


            ${
                extra.length

                ? `

                    <div class="visual-unmatched-card">

                        <h4>
                            Extra in Target
                        </h4>

                        <ul>

                            ${
                                extra
                                    .map(
                                        item => `
                                            <li>
                                                ${escapeHtml(
                                                    item.name
                                                )}
                                            </li>
                                        `
                                    )
                                    .join("")
                            }

                        </ul>

                    </div>

                `

                : ""
            }

        `;


        container.appendChild(
            section
        );

    }


    /*
     * ================================================================
     * RESULT STATUS
     * ================================================================
     */

    function getVisualStatus(
        similarity
    ) {

        if (
            similarity >= 98
        ) {

            return {

                label:
                    "Excellent Match",

                className:
                    "visual-excellent"

            };

        }


        if (
            similarity >= 95
        ) {

            return {

                label:
                    "Minor Difference",

                className:
                    "visual-minor"

            };

        }


        if (
            similarity >= 85
        ) {

            return {

                label:
                    "Noticeable Difference",

                className:
                    "visual-warning"

            };

        }


        return {

            label:
                "Major Difference",

            className:
                "visual-major"

        };

    }


    /*
     * ================================================================
     * HELPERS
     * ================================================================
     */

    function createCanvas(
        width,
        height
    ) {

        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            width;


        canvas.height =
            height;


        return canvas;

    }


    function loadImage(src) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const image =
                    new Image();


                image.onload =
                    () =>
                        resolve(
                            image
                        );


                image.onerror =
                    () =>
                        reject(
                            new Error(
                                "Image could not be loaded."
                            )
                        );


                image.src =
                    src;

            }
        );

    }


    function roundTwo(value) {

        return Math.round(
            value *
            100
        ) / 100;

    }


    function escapeHtml(value) {

        const div =
            document.createElement(
                "div"
            );


        div.textContent =
            value ||
            "";


        return div.innerHTML;

    }

})();