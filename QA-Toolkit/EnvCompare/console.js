(() => {

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            loadConsoleComparison
        );

    } else {

        loadConsoleComparison();

    }


    async function loadConsoleComparison() {

        const container =
            document.getElementById(
                "consoleComparison"
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


            const comparison =
                result?.consoleComparison;


            if (!comparison) {

                container.innerHTML = `
                    <div class="console-empty">
                        Console error comparison is unavailable.
                    </div>
                `;

                return;
            }


            renderConsoleComparison(
                container,
                comparison
            );

        }

        catch (error) {

            console.error(
                "Console report rendering failed:",
                error
            );


            container.innerHTML = `
                <div class="console-error">
                    Unable to render console comparison.
                </div>
            `;

        }

    }



    function renderConsoleComparison(
        container,
        comparison
    ) {

        container.innerHTML = "";


        const summary =
            document.createElement(
                "div"
            );


        summary.className =
            "console-summary";


        summary.innerHTML = `

            <div class="console-stat-card">
                <span>Source Errors</span>
                <strong class="${
                    comparison.sourceCount
                        ? "console-danger"
                        : "console-success"
                }">
                    ${comparison.sourceCount || 0}
                </strong>
            </div>


            <div class="console-stat-card">
                <span>Target Errors</span>
                <strong class="${
                    comparison.targetCount
                        ? "console-danger"
                        : "console-success"
                }">
                    ${comparison.targetCount || 0}
                </strong>
            </div>


            <div class="console-stat-card">
                <span>Common</span>
                <strong>
                    ${comparison.commonCount || 0}
                </strong>
            </div>


            <div class="console-stat-card">
                <span>Source Only</span>
                <strong class="${
                    comparison.sourceOnlyCount
                        ? "console-warning"
                        : ""
                }">
                    ${comparison.sourceOnlyCount || 0}
                </strong>
            </div>


            <div class="console-stat-card">
                <span>Target Only</span>
                <strong class="${
                    comparison.targetOnlyCount
                        ? "console-danger"
                        : ""
                }">
                    ${comparison.targetOnlyCount || 0}
                </strong>
            </div>

        `;


        container.appendChild(
            summary
        );


        const status =
            document.createElement(
                "div"
            );


        status.className =
            comparison.match
                ? "console-match-message"
                : "console-difference-message";


        status.textContent =
            comparison.match
                ? "✓ Console errors match between environments."
                : "✕ Console error differences were detected between environments.";


        container.appendChild(
            status
        );


        renderErrorGroup(
            container,
            "Errors Only in Target",
            comparison.targetOnly || [],
            "target-only"
        );


        renderErrorGroup(
            container,
            "Errors Only in Source",
            comparison.sourceOnly || [],
            "source-only"
        );


        const commonErrors =
            (comparison.common || [])
                .map(
                    item =>
                        item.source ||
                        item
                );


        renderErrorGroup(
            container,
            "Common Errors",
            commonErrors,
            "common"
        );


        if (
            (comparison.sourceCount || 0) === 0 &&
            (comparison.targetCount || 0) === 0
        ) {

            const clean =
                document.createElement(
                    "div"
                );


            clean.className =
                "console-clean";


            clean.textContent =
                "✓ No captured console errors were found on either environment.";


            container.appendChild(
                clean
            );

        }

    }



    function renderErrorGroup(
        container,
        title,
        errors,
        type
    ) {

        if (
            !errors ||
            errors.length === 0
        ) {
            return;
        }


        const group =
            document.createElement(
                "div"
            );


        group.className =
            `console-group ${type}`;


        const heading =
            document.createElement(
                "div"
            );


        heading.className =
            "console-group-header";


        heading.innerHTML = `

            <h3>
                ${escapeHtml(title)}
            </h3>

            <span>
                ${errors.length}
            </span>

        `;


        group.appendChild(
            heading
        );


        const list =
            document.createElement(
                "div"
            );


        list.className =
            "console-error-list";


        errors.forEach(
            error => {

                list.appendChild(
                    buildErrorItem(
                        error
                    )
                );

            }
        );


        group.appendChild(
            list
        );


        container.appendChild(
            group
        );

    }



    function buildErrorItem(
        error
    ) {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "console-error-item";


        const location =
            buildLocation(
                error
            );


        item.innerHTML = `

            <div class="console-error-top">

                <span class="console-error-type">
                    ${escapeHtml(
                        getTypeLabel(
                            error.type
                        )
                    )}
                </span>

                ${
                    location
                        ? `
                            <span class="console-error-location">
                                ${escapeHtml(location)}
                            </span>
                        `
                        : ""
                }

            </div>


            <div class="console-error-message">
                ${escapeHtml(
                    error.message ||
                    "Unknown error"
                )}
            </div>

        `;


        return item;

    }



    function getTypeLabel(
        type
    ) {

        switch (type) {

            case "console.error":
                return "Console Error";

            case "javascript":
                return "JavaScript";

            case "unhandledrejection":
                return "Promise";

            case "resource":
                return "Resource";

            default:
                return "Error";

        }

    }



    function buildLocation(
        error
    ) {

        if (!error.source) {
            return "";
        }


        let result =
            error.source;


        if (error.line) {
            result += `:${error.line}`;
        }


        if (error.column) {
            result += `:${error.column}`;
        }


        return result;

    }



    function escapeHtml(
        value
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.textContent =
            String(
                value || ""
            );


        return element.innerHTML;

    }

})();