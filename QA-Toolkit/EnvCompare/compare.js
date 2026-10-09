document.addEventListener(
    "DOMContentLoaded",
    loadComparison
);


/*
 * =====================================================
 * LOAD RESULT
 * =====================================================
 */

async function loadComparison() {

    try {

        const data =
            await chrome.storage.local.get(
                "comparisonResult"
            );


        const result =
            data.comparisonResult;


        console.log(
            "EnvCompare result:",
            result
        );


        if (
            !result
        ) {

            showError(
                "No comparison result found. Please run EnvCompare again."
            );

            return;

        }


        if (
            result.error
        ) {

            showError(
                result.error
            );

            return;

        }


        /*
         * URLs
         */

        document
            .getElementById(
                "sourceUrl"
            )
            .textContent =
            result.sourceUrl ||
            "Unknown";


        document
            .getElementById(
                "targetUrl"
            )
            .textContent =
            result.targetUrl ||
            "Unknown";


        /*
         * Environment badges
         */

        document
            .getElementById(
                "sourceEnvironment"
            )
            .textContent =
            result.sourceEnvironment ||
            "SOURCE";


        document
            .getElementById(
                "targetEnvironment"
            )
            .textContent =
            result.targetEnvironment ||
            "TARGET";


        /*
         * Timestamp
         */

        if (
            result.timestamp
        ) {

            document
                .getElementById(
                    "reportTimestamp"
                )
                .textContent =
                formatTimestamp(
                    result.timestamp
                );

        }


        if (
            !result.source ||
            !result.target ||
            !result.comparison
        ) {

            showError(
                "Comparison data is incomplete."
            );

            console.error(
                result
            );

            return;

        }


        /*
         * Phase 2
         */

        renderFunctionalComparison(
            result
        );


        renderDetailedDifferences(
            result.comparison
        );


        /*
         * Phase 3
         */

        renderHealthSummary(
            result
        );


        renderBrokenLinks(
            result
        );


        renderBrokenImages(
            result
        );


        renderFonts(
            result
        );

    }

    catch (error) {

        console.error(
            "Unable to display EnvCompare result:",
            error
        );


        showError(
            "Unable to display comparison results."
        );

    }

}


/*
 * =====================================================
 * PHASE 2
 * FUNCTIONAL SUMMARY
 * =====================================================
 */

function renderFunctionalComparison(
    result
) {

    const source =
        result.source;


    const target =
        result.target;


    const comparison =
        result.comparison;


    const tbody =
        document.getElementById(
            "comparisonBody"
        );


    tbody.innerHTML =
        "";


    addSummaryRow(
        "Page Title",
        source.title ||
        "(none)",
        target.title ||
        "(none)",
        comparison.titleMatch
    );


    addSummaryRow(
        "H1",
        source.h1 ||
        "(none)",
        target.h1 ||
        "(none)",
        comparison.h1Match
    );


    addSummaryRow(
        "Meta Description",
        source.metaDescription ||
        "(none)",
        target.metaDescription ||
        "(none)",
        comparison.metaDescriptionMatch
    );


    addSummaryRow(
        "Links",
        source.counts?.visibleLinks ??
        source.links?.length ??
        0,
        target.counts?.visibleLinks ??
        target.links?.length ??
        0,
        comparison.links?.match
    );


    addSummaryRow(
        "Images",
        source.counts?.visibleImages ??
        source.images?.length ??
        0,
        target.counts?.visibleImages ??
        target.images?.length ??
        0,
        comparison.images?.match
    );


    addSummaryRow(
        "Headings",
        source.counts?.visibleHeadings ??
        source.headings?.length ??
        0,
        target.counts?.visibleHeadings ??
        target.headings?.length ??
        0,
        comparison.headings?.match
    );


    addSummaryRow(
        "Buttons",
        source.counts?.visibleButtons ??
        source.buttons?.length ??
        0,
        target.counts?.visibleButtons ??
        target.buttons?.length ??
        0,
        comparison.buttons?.match
    );


    addSummaryRow(
        "Form Fields",
        source.counts?.visibleFormFields ??
        source.formFields?.length ??
        0,
        target.counts?.visibleFormFields ??
        target.formFields?.length ??
        0,
        comparison.formFields?.match
    );


    addSummaryRow(
        "Forms",
        source.forms?.length ??
        0,
        target.forms?.length ??
        0,
        comparison.forms?.match
    );


    addSummaryRow(
        "Navigation",
        source.navigation?.length ??
        0,
        target.navigation?.length ??
        0,
        comparison.navigation?.match
    );


    addSummaryRow(
        "Breadcrumbs",
        source.breadcrumbs?.length ??
        0,
        target.breadcrumbs?.length ??
        0,
        comparison.breadcrumbs?.match
    );

}


/*
 * =====================================================
 * SUMMARY ROW
 * =====================================================
 */

function addSummaryRow(
    label,
    sourceValue,
    targetValue,
    match
) {

    const tbody =
        document.getElementById(
            "comparisonBody"
        );


    const row =
        document.createElement(
            "tr"
        );


    const checkCell =
        document.createElement(
            "td"
        );


    checkCell.className =
        "check-name";


    checkCell.textContent =
        label;


    const sourceCell =
        document.createElement(
            "td"
        );


    sourceCell.textContent =
        formatValue(
            sourceValue
        );


    const targetCell =
        document.createElement(
            "td"
        );


    targetCell.textContent =
        formatValue(
            targetValue
        );


    const statusCell =
        document.createElement(
            "td"
        );


    if (
        match === true
    ) {

        statusCell.textContent =
            "✓ Match";

        statusCell.className =
            "status-match";

    }

    else {

        statusCell.textContent =
            "✕ Different";

        statusCell.className =
            "status-different";

    }


    row.appendChild(
        checkCell
    );

    row.appendChild(
        sourceCell
    );

    row.appendChild(
        targetCell
    );

    row.appendChild(
        statusCell
    );


    tbody.appendChild(
        row
    );

}


/*
 * =====================================================
 * PHASE 2
 * DETAILED DIFFERENCES
 * =====================================================
 */

function renderDetailedDifferences(
    comparison
) {

    const details =
        document.getElementById(
            "details"
        );


    details.innerHTML =
        "";


    addDifferenceSection(
        details,
        "Links",
        comparison.links
            ?.missingInTarget ||
        [],
        comparison.links
            ?.extraInTarget ||
        [],
        formatLink
    );


    addDifferenceSection(
        details,
        "Images",
        comparison.images
            ?.missingInTarget ||
        [],
        comparison.images
            ?.extraInTarget ||
        [],
        formatImage
    );


    addDifferenceSection(
        details,
        "Buttons",
        comparison.buttons
            ?.missingInTarget ||
        [],
        comparison.buttons
            ?.extraInTarget ||
        [],
        formatButton
    );


    addDifferenceSection(
        details,
        "Headings",
        comparison.headings
            ?.missingInTarget ||
        [],
        comparison.headings
            ?.extraInTarget ||
        [],
        formatHeading
    );


    addDifferenceSection(
        details,
        "Form Fields",
        comparison.formFields
            ?.missingInTarget ||
        [],
        comparison.formFields
            ?.extraInTarget ||
        [],
        formatFormField
    );


    addDifferenceSection(
        details,
        "Forms",
        comparison.forms
            ?.missingInTarget ||
        [],
        comparison.forms
            ?.extraInTarget ||
        [],
        formatForm
    );


    addDifferenceSection(
        details,
        "Navigation",
        comparison.navigation
            ?.missingInTarget ||
        [],
        comparison.navigation
            ?.extraInTarget ||
        [],
        formatNavigation
    );


    addDifferenceSection(
        details,
        "Breadcrumbs",
        comparison.breadcrumbs
            ?.missingInTarget ||
        [],
        comparison.breadcrumbs
            ?.extraInTarget ||
        [],
        item =>
            String(
                item
            )
    );

}


/*
 * =====================================================
 * DIFFERENCE CARD
 * =====================================================
 */

function addDifferenceSection(
    parent,
    title,
    missing,
    extra,
    formatter
) {

    const section =
        document.createElement(
            "div"
        );


    section.className =
        "difference-section";


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "difference-header";


    const heading =
        document.createElement(
            "h3"
        );


    heading.textContent =
        title;


    header.appendChild(
        heading
    );


    const total =
        missing.length +
        extra.length;


    const badge =
        document.createElement(
            "span"
        );


    if (
        total === 0
    ) {

        badge.textContent =
            "Match";

        badge.className =
            "result-badge success";

    }

    else {

        badge.textContent =
            `${total} Difference${
                total === 1
                    ? ""
                    : "s"
            }`;

        badge.className =
            "result-badge danger";

    }


    header.appendChild(
        badge
    );


    section.appendChild(
        header
    );


    if (
        total === 0
    ) {

        const message =
            document.createElement(
                "div"
            );


        message.className =
            "no-difference";


        message.textContent =
            "✓ No differences found";


        section.appendChild(
            message
        );


        parent.appendChild(
            section
        );


        return;

    }


    if (
        missing.length > 0
    ) {

        addDifferenceList(
            section,
            "Missing in Target",
            missing,
            formatter,
            "missing"
        );

    }


    if (
        extra.length > 0
    ) {

        addDifferenceList(
            section,
            "Extra in Target",
            extra,
            formatter,
            "extra"
        );

    }


    parent.appendChild(
        section
    );

}


/*
 * =====================================================
 * DIFFERENCE LIST
 * =====================================================
 */

function addDifferenceList(
    parent,
    title,
    items,
    formatter,
    type
) {

    const block =
        document.createElement(
            "div"
        );


    block.className =
        "difference-block";


    const heading =
        document.createElement(
            "div"
        );


    heading.className =
        `difference-label ${type}`;


    heading.textContent =
        `${title} (${items.length})`;


    block.appendChild(
        heading
    );


    const list =
        document.createElement(
            "ul"
        );


    list.className =
        "difference-list";


    items.forEach(
        item => {

            const li =
                document.createElement(
                    "li"
                );


            li.textContent =
                formatter(
                    item
                );


            list.appendChild(
                li
            );

        }
    );


    block.appendChild(
        list
    );


    parent.appendChild(
        block
    );

}


/*
 * =====================================================
 * PHASE 2 FORMATTERS
 * =====================================================
 */

function formatLink(
    item
) {

    return `${
        item?.text ||
        "(no text)"
    } → ${
        item?.path ||
        "(no path)"
    }`;

}


function formatImage(
    item
) {

    return `${
        item?.alt ||
        "(no alt text)"
    } → ${
        item?.fileName ||
        "(unknown file)"
    }`;

}


function formatButton(
    item
) {

    return `${
        item?.text ||
        "(no text)"
    } — ${
        item?.disabled
            ? "Disabled"
            : "Enabled"
    }`;

}


function formatHeading(
    item
) {

    return `${
        item?.tag ||
        "H?"
    } — ${
        item?.text ||
        "(empty)"
    }`;

}


function formatFormField(
    item
) {

    const pieces =
        [];


    if (
        item?.tag
    ) {

        pieces.push(
            item.tag
        );

    }


    if (
        item?.type
    ) {

        pieces.push(
            `type=${item.type}`
        );

    }


    if (
        item?.name
    ) {

        pieces.push(
            `name=${item.name}`
        );

    }


    if (
        item?.label
    ) {

        pieces.push(
            `label="${item.label}"`
        );

    }


    if (
        item?.placeholder
    ) {

        pieces.push(
            `placeholder="${item.placeholder}"`
        );

    }


    if (
        item?.required
    ) {

        pieces.push(
            "required"
        );

    }


    if (
        item?.disabled
    ) {

        pieces.push(
            "disabled"
        );

    }


    if (
        item?.options?.length
    ) {

        pieces.push(
            `options=[${item.options.join(", ")}]`
        );

    }


    return pieces.join(
        " | "
    ) ||
    "(unnamed field)";

}


function formatForm(
    item
) {

    return (
        `Method: ${
            item?.method ||
            "unknown"
        } | Action: ${
            item?.action ||
            "(none)"
        } | Fields: ${
            item?.fieldCount ??
            0
        }`
    );

}


function formatNavigation(
    item
) {

    return `${
        item?.text ||
        "(no text)"
    } → ${
        item?.path ||
        "(no path)"
    }`;

}


/*
 * =====================================================
 * PHASE 3
 * HEALTH SUMMARY
 * =====================================================
 */

function renderHealthSummary(
    result
) {

    const container =
        document.getElementById(
            "healthSummary"
        );


    container.innerHTML =
        "";


    const sourceHealth =
        result.source
            ?.health ||
        {};


    const targetHealth =
        result.target
            ?.health ||
        {};


    addHealthCard(
        container,
        result.sourceEnvironment ||
        "SOURCE",
        sourceHealth
    );


    addHealthCard(
        container,
        result.targetEnvironment ||
        "TARGET",
        targetHealth
    );

}


/*
 * =====================================================
 * HEALTH CARD
 * =====================================================
 */

function addHealthCard(
    parent,
    environment,
    health
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "health-card";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        environment;


    card.appendChild(
        title
    );


    const links =
        health.links ||
        {};


    const images =
        health.images ||
        {};


    const fonts =
        health.fonts ||
        {};


    addHealthStat(
        card,
        "Links Checked",
        links.checked ??
        0
    );


    addHealthStat(
        card,
        "Broken Links",
        links.broken ??
        0,
        (
            links.broken ||
            0
        ) > 0
    );


    addHealthStat(
        card,
        "Link Redirects",
        links.redirects ??
        0
    );


    addHealthStat(
        card,
        "Link Check Failures",
        links.failed ??
        0,
        (
            links.failed ||
            0
        ) > 0
    );


    addHealthStat(
        card,
        "Images Checked",
        images.checked ??
        0
    );


    addHealthStat(
        card,
        "Broken Images",
        images.broken ??
        0,
        (
            images.broken ||
            0
        ) > 0
    );


    addHealthStat(
        card,
        "Image Check Failures",
        images.failed ??
        0,
        (
            images.failed ||
            0
        ) > 0
    );


    addHealthStat(
        card,
        "Font Families",
        fonts.families
            ?.length ??
        0
    );


    addHealthStat(
        card,
        "Font Files",
        fonts.resources
            ?.length ??
        0
    );


    parent.appendChild(
        card
    );

}


/*
 * =====================================================
 * HEALTH STAT
 * =====================================================
 */

function addHealthStat(
    parent,
    label,
    value,
    danger = false
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "health-stat";


    const name =
        document.createElement(
            "span"
        );


    name.textContent =
        label;


    const count =
        document.createElement(
            "strong"
        );


    count.textContent =
        value;


    if (
        danger
    ) {

        count.className =
            "danger-text";

    }


    row.appendChild(
        name
    );

    row.appendChild(
        count
    );


    parent.appendChild(
        row
    );

}


/*
 * =====================================================
 * BROKEN LINKS
 * =====================================================
 */

function renderBrokenLinks(
    result
) {

    const container =
        document.getElementById(
            "brokenLinks"
        );


    container.innerHTML =
        "";


    const source =
        result.source
            ?.health
            ?.links ||
        {};


    const target =
        result.target
            ?.health
            ?.links ||
        {};


    const comparison =
        result.healthComparison
            ?.links ||
        result.comparison
            ?.health
            ?.links ||
        {};


    renderHealthTable(
        container,
        "Link Health Summary",
        result.sourceEnvironment,
        result.targetEnvironment,
        source,
        target
    );


    const sourceBroken =
        (
            source.results ||
            []
        )
            .filter(
                item =>
                    item.broken
            );


    const targetBroken =
        (
            target.results ||
            []
        )
            .filter(
                item =>
                    item.broken
            );


    renderBrokenResourceGroup(
        container,
        `${
            result.sourceEnvironment ||
            "Source"
        } Broken Links`,
        sourceBroken,
        formatHealthResource
    );


    renderBrokenResourceGroup(
        container,
        `${
            result.targetEnvironment ||
            "Target"
        } Broken Links`,
        targetBroken,
        formatHealthResource
    );


    renderStatusDifferences(
        container,
        comparison.statusDifferences ||
        [],
        "Link Status Differences"
    );

}


/*
 * =====================================================
 * BROKEN IMAGES
 * =====================================================
 */

function renderBrokenImages(
    result
) {

    const container =
        document.getElementById(
            "brokenImages"
        );


    container.innerHTML =
        "";


    const source =
        result.source
            ?.health
            ?.images ||
        {};


    const target =
        result.target
            ?.health
            ?.images ||
        {};


    const comparison =
        result.healthComparison
            ?.images ||
        result.comparison
            ?.health
            ?.images ||
        {};


    renderHealthTable(
        container,
        "Image Health Summary",
        result.sourceEnvironment,
        result.targetEnvironment,
        source,
        target
    );


    const sourceBroken =
        (
            source.results ||
            []
        )
            .filter(
                item =>
                    item.broken
            );


    const targetBroken =
        (
            target.results ||
            []
        )
            .filter(
                item =>
                    item.broken
            );


    renderBrokenResourceGroup(
        container,
        `${
            result.sourceEnvironment ||
            "Source"
        } Broken Images`,
        sourceBroken,
        formatImageHealthResource
    );


    renderBrokenResourceGroup(
        container,
        `${
            result.targetEnvironment ||
            "Target"
        } Broken Images`,
        targetBroken,
        formatImageHealthResource
    );


    renderStatusDifferences(
        container,
        comparison.statusDifferences ||
        [],
        "Image Status Differences"
    );

}


/*
 * =====================================================
 * HEALTH SUMMARY TABLE
 * =====================================================
 */

function renderHealthTable(
    parent,
    title,
    sourceName,
    targetName,
    source,
    target
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "health-table-wrapper";


    const heading =
        document.createElement(
            "h4"
        );


    heading.textContent =
        title;


    wrapper.appendChild(
        heading
    );


    const table =
        document.createElement(
            "table"
        );


    table.className =
        "health-table";


    const thead =
        document.createElement(
            "thead"
        );


    thead.innerHTML = `
        <tr>
            <th>Check</th>
            <th>${escapeText(
                sourceName ||
                "Source"
            )}</th>
            <th>${escapeText(
                targetName ||
                "Target"
            )}</th>
        </tr>
    `;


    const tbody =
        document.createElement(
            "tbody"
        );


    addHealthTableRow(
        tbody,
        "Checked",
        source.checked ?? 0,
        target.checked ?? 0
    );


    addHealthTableRow(
        tbody,
        "Working",
        source.working ?? 0,
        target.working ?? 0
    );


    addHealthTableRow(
        tbody,
        "Broken",
        source.broken ?? 0,
        target.broken ?? 0,
        true
    );


    addHealthTableRow(
        tbody,
        "Redirects",
        source.redirects ?? 0,
        target.redirects ?? 0
    );


    addHealthTableRow(
        tbody,
        "Protected",
        source.protected ?? 0,
        target.protected ?? 0
    );


    addHealthTableRow(
        tbody,
        "Request Failures",
        source.failed ?? 0,
        target.failed ?? 0,
        true
    );


    table.appendChild(
        thead
    );

    table.appendChild(
        tbody
    );


    wrapper.appendChild(
        table
    );


    parent.appendChild(
        wrapper
    );

}


/*
 * =====================================================
 * HEALTH TABLE ROW
 * =====================================================
 */

function addHealthTableRow(
    tbody,
    label,
    source,
    target,
    warning = false
) {

    const row =
        document.createElement(
            "tr"
        );


    const labelCell =
        document.createElement(
            "td"
        );


    labelCell.textContent =
        label;


    const sourceCell =
        document.createElement(
            "td"
        );


    sourceCell.textContent =
        source;


    const targetCell =
        document.createElement(
            "td"
        );


    targetCell.textContent =
        target;


    if (
        warning &&
        Number(source) > 0
    ) {

        sourceCell.className =
            "danger-text";

    }


    if (
        warning &&
        Number(target) > 0
    ) {

        targetCell.className =
            "danger-text";

    }


    row.appendChild(
        labelCell
    );

    row.appendChild(
        sourceCell
    );

    row.appendChild(
        targetCell
    );


    tbody.appendChild(
        row
    );

}


/*
 * =====================================================
 * BROKEN RESOURCE GROUP
 * =====================================================
 */

function renderBrokenResourceGroup(
    parent,
    title,
    items,
    formatter
) {

    const box =
        document.createElement(
            "div"
        );


    box.className =
        "resource-group";


    const heading =
        document.createElement(
            "h4"
        );


    heading.textContent =
        title;


    box.appendChild(
        heading
    );


    if (
        items.length === 0
    ) {

        const success =
            document.createElement(
                "div"
            );


        success.className =
            "health-success";


        success.textContent =
            "✓ No broken resources found";


        box.appendChild(
            success
        );


        parent.appendChild(
            box
        );


        return;

    }


    const list =
        document.createElement(
            "div"
        );


    list.className =
        "resource-list";


    items.forEach(
        item => {

            const resource =
                document.createElement(
                    "div"
                );


            resource.className =
                "resource-item";


            const content =
                document.createElement(
                    "div"
                );


            content.className =
                "resource-content";


            const path =
                document.createElement(
                    "div"
                );


            path.className =
                "resource-path";


            path.textContent =
                formatter(
                    item
                );


            const url =
                document.createElement(
                    "div"
                );


            url.className =
                "resource-url";


            url.textContent =
                item.url ||
                "";


            content.appendChild(
                path
            );

            content.appendChild(
                url
            );


            const status =
                createHttpStatusBadge(
                    item
                );


            resource.appendChild(
                content
            );

            resource.appendChild(
                status
            );


            list.appendChild(
                resource
            );

        }
    );


    box.appendChild(
        list
    );


    parent.appendChild(
        box
    );

}


/*
 * =====================================================
 * STATUS DIFFERENCES
 * =====================================================
 */

function renderStatusDifferences(
    parent,
    differences,
    title
) {

    const box =
        document.createElement(
            "div"
        );


    box.className =
        "resource-group";


    const heading =
        document.createElement(
            "h4"
        );


    heading.textContent =
        title;


    box.appendChild(
        heading
    );


    if (
        differences.length === 0
    ) {

        const success =
            document.createElement(
                "div"
            );


        success.className =
            "health-success";


        success.textContent =
            "✓ No environment status differences";


        box.appendChild(
            success
        );


        parent.appendChild(
            box
        );


        return;

    }


    const table =
        document.createElement(
            "table"
        );


    table.className =
        "health-table";


    table.innerHTML = `
        <thead>
            <tr>
                <th>Path</th>
                <th>Source</th>
                <th>Target</th>
            </tr>
        </thead>
    `;


    const tbody =
        document.createElement(
            "tbody"
        );


    differences.forEach(
        difference => {

            const row =
                document.createElement(
                    "tr"
                );


            const path =
                document.createElement(
                    "td"
                );


            path.textContent =
                difference.path ||
                "(unknown)";


            const source =
                document.createElement(
                    "td"
                );


            source.textContent =
                formatStatusValue(
                    difference.source
                );


            const target =
                document.createElement(
                    "td"
                );


            target.textContent =
                formatStatusValue(
                    difference.target
                );


            row.appendChild(
                path
            );

            row.appendChild(
                source
            );

            row.appendChild(
                target
            );


            tbody.appendChild(
                row
            );

        }
    );


    table.appendChild(
        tbody
    );


    box.appendChild(
        table
    );


    parent.appendChild(
        box
    );

}


/*
 * =====================================================
 * PHASE 3
 * FONT COMPARISON
 * =====================================================
 */

function renderFonts(
    result
) {

    const container =
        document.getElementById(
            "fontComparison"
        );


    container.innerHTML =
        "";


    const comparison =
        result.healthComparison
            ?.fonts ||
        result.comparison
            ?.health
            ?.fonts;


    if (
        !comparison
    ) {

        container.textContent =
            "Font comparison data is unavailable.";

        return;

    }


    /*
     * Summary
     */

    const summary =
        document.createElement(
            "div"
        );


    summary.className =
        "font-summary";


    addFontSummaryCard(
        summary,
        result.sourceEnvironment ||
        "Source",
        comparison.sourceFamilyCount,
        comparison.sourceFileCount
    );


    addFontSummaryCard(
        summary,
        result.targetEnvironment ||
        "Target",
        comparison.targetFamilyCount,
        comparison.targetFileCount
    );


    container.appendChild(
        summary
    );


    /*
     * Families
     */

    renderFontDifferenceGroup(
        container,
        "Font Families Missing in Target",
        comparison.missingFamiliesInTarget ||
        [],
        formatFontFamily
    );


    renderFontDifferenceGroup(
        container,
        "Extra Font Families in Target",
        comparison.extraFamiliesInTarget ||
        [],
        formatFontFamily
    );


    /*
     * Font files
     */

    renderFontDifferenceGroup(
        container,
        "Font Files Missing in Target",
        comparison.missingFilesInTarget ||
        [],
        formatFontFile
    );


    renderFontDifferenceGroup(
        container,
        "Extra Font Files in Target",
        comparison.extraFilesInTarget ||
        [],
        formatFontFile
    );


    if (
        comparison.match
    ) {

        const success =
            document.createElement(
                "div"
            );


        success.className =
            "font-match-message";


        success.textContent =
            "✓ Font families and font files match between environments";


        container.prepend(
            success
        );

    }

}


/*
 * =====================================================
 * FONT SUMMARY CARD
 * =====================================================
 */

function addFontSummaryCard(
    parent,
    environment,
    families,
    files
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "font-card";


    const title =
        document.createElement(
            "h4"
        );


    title.textContent =
        environment;


    card.appendChild(
        title
    );


    const family =
        document.createElement(
            "div"
        );


    family.innerHTML =
        `<span>Font Families</span><strong>${
            families ??
            0
        }</strong>`;


    const file =
        document.createElement(
            "div"
        );


    file.innerHTML =
        `<span>Font Files</span><strong>${
            files ??
            0
        }</strong>`;


    card.appendChild(
        family
    );

    card.appendChild(
        file
    );


    parent.appendChild(
        card
    );

}


/*
 * =====================================================
 * FONT DIFFERENCE GROUP
 * =====================================================
 */

function renderFontDifferenceGroup(
    parent,
    title,
    items,
    formatter
) {

    const section =
        document.createElement(
            "div"
        );


    section.className =
        "font-difference-group";


    const heading =
        document.createElement(
            "h4"
        );


    heading.textContent =
        `${title} (${items.length})`;


    section.appendChild(
        heading
    );


    if (
        items.length === 0
    ) {

        const text =
            document.createElement(
                "div"
            );


        text.className =
            "health-success";


        text.textContent =
            "✓ None";


        section.appendChild(
            text
        );


        parent.appendChild(
            section
        );


        return;

    }


    const list =
        document.createElement(
            "ul"
        );


    list.className =
        "difference-list";


    items.forEach(
        item => {

            const li =
                document.createElement(
                    "li"
                );


            li.textContent =
                formatter(
                    item
                );


            list.appendChild(
                li
            );

        }
    );


    section.appendChild(
        list
    );


    parent.appendChild(
        section
    );

}


/*
 * =====================================================
 * PHASE 3 FORMATTERS
 * =====================================================
 */

function formatHealthResource(
    item
) {

    return (
        item.relativePath ||
        item.url ||
        "(unknown link)"
    );

}


function formatImageHealthResource(
    item
) {

    const fileName =
        item.fileName ||
        "(unknown image)";


    const path =
        item.relativePath ||
        "";


    return `${fileName} ${
        path
            ? "— " + path
            : ""
    }`;

}


function formatStatusValue(
    value
) {

    if (
        !value
    ) {

        return "Unknown";

    }


    const status =
        value.status ||
        "Failed";


    let result =
        `${status} - ${
            formatClassification(
                value.classification
            )
        }`;


    if (
        value.redirected
    ) {

        result +=
            " (redirected)";

    }


    return result;

}


function formatFontFamily(
    font
) {

    return `${
        font.family ||
        "(unknown font)"
    } | Weight: ${
        font.weight ||
        "normal"
    } | Style: ${
        font.style ||
        "normal"
    }`;

}


function formatFontFile(
    font
) {

    return `${
        font.fileName ||
        "(unknown file)"
    }${
        font.path
            ? " → " + font.path
            : ""
    }`;

}


/*
 * =====================================================
 * HTTP STATUS BADGE
 * =====================================================
 */

function createHttpStatusBadge(
    item
) {

    const badge =
        document.createElement(
            "span"
        );


    badge.className =
        "http-status";


    if (
        item.status
    ) {

        badge.textContent =
            item.status;

    }

    else {

        badge.textContent =
            "Failed";

    }


    switch (
        item.classification
    ) {

        case "working":

            badge.classList.add(
                "http-success"
            );

            break;


        case "protected":

            badge.classList.add(
                "http-protected"
            );

            break;


        case "redirect":

            badge.classList.add(
                "http-redirect"
            );

            break;


        case "broken":

        case "server-error":

            badge.classList.add(
                "http-error"
            );

            break;


        default:

            badge.classList.add(
                "http-failed"
            );

    }


    return badge;

}


/*
 * =====================================================
 * CLASSIFICATION LABEL
 * =====================================================
 */

function formatClassification(
    value
) {

    switch (
        value
    ) {

        case "working":
            return "Working";

        case "broken":
            return "Broken";

        case "server-error":
            return "Server Error";

        case "protected":
            return "Protected";

        case "redirect":
            return "Redirect";

        case "timeout":
            return "Timeout";

        case "failed":
            return "Request Failed";

        default:
            return value ||
            "Unknown";

    }

}


/*
 * =====================================================
 * GENERIC FORMAT
 * =====================================================
 */

function formatValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "(none)";

    }


    return String(
        value
    );

}


/*
 * =====================================================
 * TIMESTAMP
 * =====================================================
 */

function formatTimestamp(
    value
) {

    try {

        return new Date(
            value
        )
            .toLocaleString();

    }

    catch {

        return value;

    }

}


/*
 * =====================================================
 * SIMPLE HTML ESCAPE
 * =====================================================
 */

function escapeText(
    value
) {

    return String(
        value ||
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/*
 * =====================================================
 * ERROR
 * =====================================================
 */

function showError(
    message
) {

    const error =
        document.getElementById(
            "error"
        );


    if (
        error
    ) {

        error.textContent =
            message;

        error.style.display =
            "block";

    }


    console.error(
        message
    );


}