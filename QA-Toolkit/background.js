/*
 * =====================================================
 * QA TOOLKIT
 * MAIN BACKGROUND SERVICE WORKER
 * =====================================================
 */


/*
 * ENVCOMPARE
 */
importScripts(
    "EnvCompare/visualCapture.js"
);

importScripts(
    "EnvCompare/consoleCapture.js"
);

importScripts(
    "EnvCompare/background.js"
);


/*
 * API WATCHDOG
 */
importScripts(
    "API_Plugin/background.js"
);


console.log(
    "QA Toolkit background initialized."
);