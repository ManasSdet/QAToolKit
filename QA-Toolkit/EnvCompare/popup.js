(() => {

  let currentTab = null;

  let currentEnvironment = "UNKNOWN";

  let generatedTargetUrl = "";


  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


 async function initialize() {

  try {

    /*
     * ==============================================
     * GET ORIGINAL WEBSITE TAB
     * ==============================================
     */

    const params =
      new URLSearchParams(
        window.location.search
      );

    const sourceTabIdText =
      params.get(
        "sourceTabId"
      );

    console.log(
      "EnvCompare sourceTabId:",
      sourceTabIdText
    );


    if (!sourceTabIdText) {

      throw new Error(
        "Source tab ID was not provided."
      );

    }


    const sourceTabId =
      parseInt(
        sourceTabIdText,
        10
      );


    if (
      !Number.isInteger(sourceTabId)
    ) {

      throw new Error(
        "Invalid source tab ID."
      );

    }


    /*
     * Get original website tab.
     */

    currentTab =
      await chrome.tabs.get(
        sourceTabId
      );


    console.log(
      "EnvCompare source tab:",
      currentTab
    );


    if (
      !currentTab ||
      !currentTab.id ||
      !currentTab.url
    ) {

      throw new Error(
        "Unable to retrieve original website tab."
      );

    }


    /*
     * Make sure source is an actual website.
     */

    if (
      !currentTab.url.startsWith(
        "http://"
      ) &&
      !currentTab.url.startsWith(
        "https://"
      )
    ) {

      throw new Error(
        "Source tab is not an HTTP/HTTPS website."
      );

    }


    /*
     * ==============================================
     * DISPLAY CURRENT URL
     * ==============================================
     */

    const currentUrlElement =
      document.getElementById(
        "currentUrl"
      );


    if (currentUrlElement) {

      currentUrlElement.textContent =
        currentTab.url;

    }


    /*
     * ==============================================
     * DETECT ENVIRONMENT
     * ==============================================
     */

    currentEnvironment =
      detectEnvironment(
        currentTab.url
      );


    const currentEnvElement =
      document.getElementById(
        "currentEnv"
      );


    if (currentEnvElement) {

      currentEnvElement.textContent =
        currentEnvironment;

    }


    /*
     * ==============================================
     * ENVIRONMENT DROPDOWN
     * ==============================================
     */

    const compareEnv =
      document.getElementById(
        "compareEnv"
      );


    if (compareEnv) {

      compareEnv.addEventListener(
        "change",
        previewTargetUrl
      );

    }


    /*
     * ==============================================
     * COMPARE BUTTON
     * ==============================================
     */

    const compareBtn =
      document.getElementById(
        "compareBtn"
      );


    if (compareBtn) {

      compareBtn.addEventListener(
        "click",
        comparePages
      );

    }


    /*
     * ==============================================
     * REGENERATE TARGET URL
     * ==============================================
     */

    const resetTargetUrlBtn =
      document.getElementById(
        "resetTargetUrlBtn"
      );


    if (resetTargetUrlBtn) {

      resetTargetUrlBtn.addEventListener(
        "click",
        () => {

          const targetUrlInput =
            document.getElementById(
              "targetUrl"
            );


          if (targetUrlInput) {

            targetUrlInput.value =
              generatedTargetUrl;

          }


          showStatus(
            "Target URL regenerated."
          );

        }
      );

    }


    /*
     * Initialization successful.
     */

    showStatus("");

  }
  catch (error) {

    console.error(
      "EnvCompare initialization failed:",
      error
    );


    const currentEnvElement =
      document.getElementById(
        "currentEnv"
      );


    if (currentEnvElement) {

      currentEnvElement.textContent =
        "ERROR";

    }


    showStatus(
      "Unable to access the original website tab. " +
      (
        error.message ||
        "Unknown error"
      )
    );

  }

}



  function detectEnvironment(url) {

    try {

      const parsed =
        new URL(url);


      const hostname =
        parsed.hostname
          .toLowerCase();


      if (
        containsEnvironment(
          hostname,
          "sit"
        )
      ) {
        return "SIT";
      }


      if (
        containsEnvironment(
          hostname,
          "uat"
        )
      ) {
        return "UAT";
      }


      if (
        containsEnvironment(
          hostname,
          "stage"
        ) ||
        containsEnvironment(
          hostname,
          "staging"
        )
      ) {
        return "STAGE";
      }


      if (
        containsEnvironment(
          hostname,
          "prod"
        )
      ) {
        return "PROD";
      }


      /*
       * Treat www as production.
       */

      if (
        hostname.startsWith("www.")
      ) {
        return "PROD";
      }


      return "UNKNOWN";

    }

    catch (error) {

      console.error(error);

      return "UNKNOWN";

    }

  }



  function containsEnvironment(
    hostname,
    environment
  ) {

    const pattern =
      new RegExp(
        `(^|[.-])${environment}([.-]|$)`,
        "i"
      );


    return pattern.test(
      hostname
    );

  }



  function previewTargetUrl() {

    const selectedEnvironment =
      document
        .getElementById(
          "compareEnv"
        )
        .value;


    const targetUrlInput =
      document
        .getElementById(
          "targetUrl"
        );


    if (!selectedEnvironment) {

      generatedTargetUrl = "";

      targetUrlInput.value = "";

      targetUrlInput.placeholder =
        "Select an environment";

      return;
    }


    try {

      const targetUrl =
        generateEnvironmentUrl(
          currentTab.url,
          selectedEnvironment
        );


      /*
       * Save the automatically generated URL.
       */

      generatedTargetUrl =
        targetUrl;


      /*
       * NEW:
       * targetUrl is now an INPUT field,
       * so use .value instead of .textContent.
       */

      targetUrlInput.value =
        targetUrl;


      showStatus("");

    }

    catch (error) {

      generatedTargetUrl = "";

      targetUrlInput.value = "";

      targetUrlInput.placeholder =
        "Enter target URL manually";


      showStatus(
        error.message +
        " You can enter the target URL manually."
      );

    }

  }



  async function comparePages() {

    const targetEnvironment =
      document
        .getElementById(
          "compareEnv"
        )
        .value;


    if (!targetEnvironment) {

      showStatus(
        "Please select an environment."
      );

      return;

    }


    if (
      targetEnvironment ===
      currentEnvironment
    ) {

      showStatus(
        `You are already on ${targetEnvironment}.`
      );

      return;

    }


    /*
     * NEW:
     * Use the URL currently present in the input.
     *
     * This may be:
     * 1. Auto-generated URL
     * 2. Manually edited URL
     */

    const targetUrl =
      document
        .getElementById(
          "targetUrl"
        )
        .value
        .trim();


    if (!targetUrl) {

      showStatus(
        "Please enter a target URL."
      );

      return;

    }


    /*
     * Validate URL.
     */

    try {

      const parsedTargetUrl =
        new URL(
          targetUrl
        );


      if (
        parsedTargetUrl.protocol !==
          "http:" &&
        parsedTargetUrl.protocol !==
          "https:"
      ) {

        throw new Error(
          "Unsupported URL protocol."
        );

      }

    }

    catch (error) {

      showStatus(
        "Please enter a valid HTTP or HTTPS target URL."
      );

      return;

    }


    showStatus(
      `Comparing with ${targetEnvironment}...`
    );


    chrome.runtime.sendMessage({

      action:
        "COMPARE_CUSTOM_URL",

      sourceTabId:
        currentTab.id,

      sourceUrl:
        currentTab.url,

      /*
       * IMPORTANT:
       * Send the actual value from the editable field.
       */

      targetUrl:
        targetUrl,

      sourceEnvironment:
        currentEnvironment,

      targetEnvironment:
        targetEnvironment

    });

  }



  function generateEnvironmentUrl(
    currentUrl,
    targetEnvironment
  ) {

    const parsed =
      new URL(currentUrl);


    let hostname =
      parsed.hostname;


    const target =
      targetEnvironment
        .toLowerCase();


    /*
     * --------------------------------
     * Pattern 1
     *
     * stage.example.com
     * uat.example.com
     * sit.example.com
     * --------------------------------
     */

    const subdomainPattern =
      /^(sit|uat|stage|staging|prod)\./i;


    if (
      subdomainPattern.test(
        hostname
      )
    ) {

      if (
        targetEnvironment ===
        "PROD"
      ) {

        hostname =
          hostname.replace(
            subdomainPattern,
            "www."
          );

      }

      else {

        hostname =
          hostname.replace(
            subdomainPattern,
            `${target}.`
          );

      }


      return buildUrl(
        parsed,
        hostname
      );

    }



    /*
     * --------------------------------
     * Pattern 2
     *
     * example-stage.com
     * example-uat.com
     * example-sit.com
     * --------------------------------
     */

    const dashPattern =
      /-(sit|uat|stage|staging|prod)(?=\.|$)/i;


    if (
      dashPattern.test(
        hostname
      )
    ) {

      if (
        targetEnvironment ===
        "PROD"
      ) {

        hostname =
          hostname.replace(
            dashPattern,
            ""
          );

      }

      else {

        hostname =
          hostname.replace(
            dashPattern,
            `-${target}`
          );

      }


      return buildUrl(
        parsed,
        hostname
      );

    }



    /*
     * --------------------------------
     * Pattern 3
     *
     * stage-example.com
     * uat-example.com
     * sit-example.com
     * --------------------------------
     */

    const prefixDashPattern =
      /^(sit|uat|stage|staging|prod)-/i;


    if (
      prefixDashPattern.test(
        hostname
      )
    ) {

      if (
        targetEnvironment ===
        "PROD"
      ) {

        hostname =
          hostname.replace(
            prefixDashPattern,
            ""
          );

      }

      else {

        hostname =
          hostname.replace(
            prefixDashPattern,
            `${target}-`
          );

      }


      return buildUrl(
        parsed,
        hostname
      );

    }



    /*
     * --------------------------------
     * Pattern 4
     *
     * www.example.com
     *
     * Assume WWW = Production
     * --------------------------------
     */

    if (
      hostname
        .toLowerCase()
        .startsWith("www.")
    ) {

      if (
        targetEnvironment ===
        "PROD"
      ) {

        return currentUrl;

      }


      hostname =
        hostname.replace(
          /^www\./i,
          `${target}.`
        );


      return buildUrl(
        parsed,
        hostname
      );

    }



    /*
     * --------------------------------
     * No recognizable environment
     * --------------------------------
     */

    throw new Error(
      "Unable to detect environment pattern in this URL."
    );

  }



  function buildUrl(
    parsedUrl,
    hostname
  ) {

    return (
      parsedUrl.protocol +
      "//" +
      hostname +
      (
        parsedUrl.port
          ? ":" + parsedUrl.port
          : ""
      ) +
      parsedUrl.pathname +
      parsedUrl.search +
      parsedUrl.hash
    );

  }



  function showStatus(message) {

    document
      .getElementById(
        "status"
      )
      .textContent =
      message;

  }

})();