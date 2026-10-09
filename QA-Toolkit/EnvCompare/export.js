/*
 * =====================================================
 * ENVCOMPARE - PDF EXPORT
 * =====================================================
 */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const exportButton =
            document.getElementById(
                "exportPdfBtn"
            );


        if (!exportButton) {

            console.error(
                "EnvCompare: Export PDF button not found."
            );

            return;

        }


        console.log(
            "EnvCompare: PDF export initialized."
        );


        exportButton.addEventListener(
            "click",
            () => {

                console.log(
                    "EnvCompare: Export Report clicked."
                );


                exportReport();

            }
        );

    }
);



function exportReport() {

    try {

        /*
         * Get environment names from the
         * already rendered report.
         */

        const sourceEnvironment =
            document
                .getElementById(
                    "sourceEnvironment"
                )
                ?.textContent
                ?.trim() ||
            "SOURCE";


        const targetEnvironment =
            document
                .getElementById(
                    "targetEnvironment"
                )
                ?.textContent
                ?.trim() ||
            "TARGET";


        /*
         * Build report date.
         */

        const now =
            new Date();


        const year =
            now.getFullYear();


        const month =
            String(
                now.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                now.getDate()
            ).padStart(
                2,
                "0"
            );


        const date =
            `${year}-${month}-${day}`;


        /*
         * Save existing browser title.
         */

        const originalTitle =
            document.title;


        /*
         * Chromium uses the document title
         * as the suggested Save as PDF name.
         */

        document.title =
            `EnvCompare_${cleanFileName(
                sourceEnvironment
            )}_vs_${cleanFileName(
                targetEnvironment
            )}_${date}`;


        /*
         * Add export mode only for printing.
         */

        document.body.classList.add(
            "pdf-export-mode"
        );


        /*
         * Let the browser finish one paint.
         */

        requestAnimationFrame(
            () => {

                requestAnimationFrame(
                    () => {

                        console.log(
                            "EnvCompare: Opening print dialog."
                        );


                        window.print();

                    }
                );

            }
        );


        /*
         * Restore page after print dialog closes.
         */

        const restoreReport =
            () => {

                document.title =
                    originalTitle;


                document.body.classList.remove(
                    "pdf-export-mode"
                );

            };


        window.addEventListener(
            "afterprint",
            restoreReport,
            {
                once: true
            }
        );


        /*
         * Fallback in case afterprint
         * is not triggered by the browser.
         */

        setTimeout(
            () => {

                document.title =
                    originalTitle;


                document.body.classList.remove(
                    "pdf-export-mode"
                );

            },
            5000
        );

    }

    catch (error) {

        console.error(
            "EnvCompare PDF export failed:",
            error
        );


        alert(
            "Unable to open PDF export. Please check the browser console."
        );

    }

}



function cleanFileName(
    value
) {

    return String(
        value ||
        "Environment"
    )
        .trim()
        .replace(
            /[^a-z0-9_-]+/gi,
            "_"
        );

}