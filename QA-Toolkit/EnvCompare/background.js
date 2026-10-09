
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (
      message.action ===
      "COMPARE_CUSTOM_URL"
    ) {

      comparePages(
        message.sourceTabId,
        message.sourceUrl,
        message.targetUrl,
        message.sourceEnvironment,
        message.targetEnvironment
      );

    }

  }
);


/*
 * =====================================================
 * CONFIGURATION
 * =====================================================
 */

const HEALTH_CONFIG = {

  /*
   * Avoid hammering large applications.
   */

  maxLinksPerPage: 50,

  maxImagesPerPage: 50,

  /*
   * Number of health-check requests
   * that run at the same time.
   */

  concurrency: 6,

  /*
   * Timeout for each URL.
   */

  timeoutMs: 10000

};


/*
 * =====================================================
 * MAIN COMPARISON FLOW
 * =====================================================
 */

async function comparePages(
  sourceTabId,
  sourceUrl,
  targetUrl,
  sourceEnvironment,
  targetEnvironment
) {

  let targetTabId = null;

  try {

    console.log(
      "Starting EnvCompare..."
    );

    console.log(
      "Source URL:",
      sourceUrl
    );

    console.log(
      "Target URL:",
      targetUrl
    );


    /*
     * =================================================
     * STEP 1
     * Extract source page
     * =================================================
     */

    const sourceData =
      await extractPageData(
        sourceTabId
      );


    /*
     * =================================================
     * STEP 2
     * Open target environment
     * =================================================
     */

    const targetTab =
      await chrome.tabs.create({

        url:
          targetUrl,

        active:
          false

      });


    targetTabId =
      targetTab.id;


    /*
     * =================================================
     * STEP 3
     * Wait for target page
     * =================================================
     */

    await waitForTabToLoad(
      targetTabId
    );


    /*
     * Additional wait for dynamic/AEM content.
     */

    await sleep(
      2000
    );


    /*
     * =================================================
     * STEP 4
     * Extract target page
     * =================================================
     */

    const targetData =
      await extractPageData(
        targetTabId
      );
	  
	  const visualComparison =
    await captureVisualComparison(
        sourceTabId,
        targetTab.id
    );


    /*
     * =================================================
     * STEP 5
     * PHASE 2 FUNCTIONAL COMPARISON
     * =================================================
     */

    const comparison =
      comparePageData(
        sourceData,
        targetData
      );


    /*
     * =================================================
     * STEP 6
     * PHASE 3 HEALTH VALIDATION
     *
     * Run source and target checks in parallel.
     * =================================================
     */

    console.log(
      "Starting Phase 3 health checks..."
    );


    const [
      sourceHealth,
      targetHealth
    ] =
      await Promise.all([

        validatePageHealth(
          sourceData,
          sourceUrl
        ),

        validatePageHealth(
          targetData,
          targetUrl
        )

      ]);


    /*
     * =================================================
     * STEP 7
     * Compare health results
     * =================================================
     */

    const healthComparison =
      compareHealthResults(
        sourceHealth,
        targetHealth
      );


    /*
     * Store Phase 3 under comparison as well.
     */

    comparison.health =
      healthComparison;
	  
	  /*
 * =================================================
 * PHASE 5
 * CONSOLE ERROR COMPARISON
 * =================================================
 */

console.log(
  "Collecting console errors..."
);


const [
  sourceConsoleErrors,
  targetConsoleErrors
] =
  await Promise.all([

    captureConsoleErrors(
      sourceTabId
    ),

    captureConsoleErrors(
      targetTabId
    )

  ]);


const consoleComparison =
  compareConsoleErrors(
    sourceConsoleErrors,
    targetConsoleErrors
  );


console.log(
  "Console comparison:",
  consoleComparison
);


    /*
     * =================================================
     * STEP 8
     * SAVE RESULT
     * =================================================
     */

    const comparisonResult = {

      sourceEnvironment:
        sourceEnvironment ||
        "UNKNOWN",

      targetEnvironment:
        targetEnvironment ||
        "UNKNOWN",

      sourceUrl,

      targetUrl,

      source: {

        ...sourceData,

        health:
          sourceHealth

      },

      target: {

        ...targetData,

        health:
          targetHealth

      },

      comparison,

      /*
       * Also available directly for
       * easier Phase 3 UI rendering.
       */

      healthComparison,
	  
	  /*
   * Phase 4 Visual Component Comparison
   */
  visualComparison,
  
  consoleComparison,

consoleErrors: {

  source:
    sourceConsoleErrors,

  target:
    targetConsoleErrors

},

      timestamp:
        new Date()
          .toISOString()

    };


    await chrome.storage.local.set({
      comparisonResult
    });
	
	


    /*
     * =================================================
     * STEP 9
     * OPEN REPORT
     * =================================================
     */

    await chrome.tabs.create({

      url:
        chrome.runtime.getURL(
          "EnvCompare/compare.html"
        )

    });


    console.log(
      "EnvCompare completed successfully."
    );

  }

  catch (error) {

    console.error(
      "EnvCompare comparison failed:",
      error
    );


    await chrome.storage.local.set({

      comparisonResult: {

        error:
          error.message ||
          "Unknown comparison error",

        sourceUrl,

        targetUrl,

        timestamp:
          new Date()
            .toISOString()

      }

    });


    await chrome.tabs.create({

      url:
        chrome.runtime.getURL(
          "EnvCompare/compare.html"
        )

    });

  }

}


/*
 * =====================================================
 * EXTRACT PAGE INFORMATION
 * =====================================================
 */

async function extractPageData(
  tabId
) {

  try {

    const results =
      await chrome.scripting.executeScript({

        target: {
          tabId
        },

        func:
          collectPageData

      });


    if (
      !results ||
      results.length === 0 ||
      !results[0] ||
      !results[0].result
    ) {

      throw new Error(
        "Unable to extract page information."
      );

    }


    return results[0].result;

  }

  catch (error) {

    console.error(
      "Page extraction failed:",
      error
    );


    throw new Error(
      "Unable to inspect the page. " +
      "Make sure the page is accessible to the extension."
    );

  }

}


/*
 * =====================================================
 * RUNS INSIDE WEBSITE TAB
 * =====================================================
 */

function collectPageData() {


  /*
   * =================================================
   * HELPER: VISIBILITY
   * =================================================
   */

  function isVisible(
    element
  ) {

    return !!(
      element.offsetWidth ||
      element.offsetHeight ||
      element
        .getClientRects()
        .length
    );

  }


  /*
   * =================================================
   * HELPER: RELATIVE PATH
   * =================================================
   */

  function getRelativePath(
    href
  ) {

    if (!href) {
      return "";
    }


    try {

      const parsed =
        new URL(
          href,
          window.location.origin
        );


      return (
        parsed.pathname +
        parsed.search +
        parsed.hash
      );

    }

    catch {

      return href;

    }

  }


  /*
   * =================================================
   * LINKS
   * =================================================
   */

  const links =
    Array.from(
      document.querySelectorAll(
        "a"
      )
    )
      .map(
        link => ({

          text:
            (
              link.innerText ||
              link.textContent ||
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim(),

          href:
            link.href ||
            "",

          relativePath:
            getRelativePath(
              link.href
            ),

          visible:
            isVisible(
              link
            ),

          target:
            link.target ||
            ""

        })
      );


  /*
   * =================================================
   * IMAGES
   * =================================================
   */

  const images =
    Array.from(
      document.querySelectorAll(
        "img"
      )
    )
      .map(
        image => {

          let fileName =
            "";


          try {

            const parsed =
              new URL(
                image.currentSrc ||
                image.src,
                window.location.origin
              );


            fileName =
              parsed.pathname
                .split("/")
                .pop() ||
              "";

          }

          catch {

            fileName =
              "";

          }


          return {

            src:
              image.currentSrc ||
              image.src ||
              "",

            fileName,

            alt:
              image.alt ||
              "",

            width:
              image.naturalWidth ||
              image.width ||
              0,

            height:
              image.naturalHeight ||
              image.height ||
              0,

            complete:
              image.complete,

            visible:
              isVisible(
                image
              )

          };

        }
      );


  /*
   * =================================================
   * HEADINGS
   * =================================================
   */

  const headings =
    Array.from(
      document.querySelectorAll(
        "h1, h2, h3, h4, h5, h6"
      )
    )
      .map(
        heading => ({

          tag:
            heading.tagName,

          text:
            (
              heading.innerText ||
              heading.textContent ||
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim(),

          visible:
            isVisible(
              heading
            )

        })
      );


  /*
   * =================================================
   * BUTTONS
   * =================================================
   */

  const buttons =
    Array.from(
      document.querySelectorAll(
        `
        button,
        input[type="button"],
        input[type="submit"],
        input[type="reset"],
        [role="button"]
        `
      )
    )
      .map(
        button => {

          const text =
            (
              button.innerText ||
              button.value ||
              button.getAttribute(
                "aria-label"
              ) ||
              button.getAttribute(
                "title"
              ) ||
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim();


          return {

            text,

            disabled:
              !!button.disabled,

            visible:
              isVisible(
                button
              )

          };

        }
      );


  /*
   * =================================================
   * FORM FIELDS
   * =================================================
   */

  const formFields =
    Array.from(
      document.querySelectorAll(
        "input, select, textarea"
      )
    )
      .map(
        field => {

          let label =
            "";


          if (
            field.id
          ) {

            try {

              const labelElement =
                document.querySelector(
                  `label[for="${CSS.escape(field.id)}"]`
                );


              if (
                labelElement
              ) {

                label =
                  (
                    labelElement.innerText ||
                    labelElement.textContent ||
                    ""
                  )
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim();

              }

            }

            catch {

              /*
               * Ignore malformed IDs.
               */

            }

          }


          if (
            !label
          ) {

            const parentLabel =
              field.closest(
                "label"
              );


            if (
              parentLabel
            ) {

              label =
                (
                  parentLabel.innerText ||
                  parentLabel.textContent ||
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim();

            }

          }


          if (
            !label
          ) {

            label =
              field.getAttribute(
                "aria-label"
              ) ||
              "";

          }


          const options =
            field.tagName ===
            "SELECT"

              ? Array.from(
                  field.options
                )
                  .map(
                    option =>
                      option.text
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                  )

              : [];


          return {

            tag:
              field.tagName,

            type:
              field.type ||
              "",

            name:
              field.name ||
              "",

            id:
              field.id ||
              "",

            label,

            placeholder:
              field.placeholder ||
              "",

            required:
              !!field.required,

            disabled:
              !!field.disabled,

            options,

            visible:
              isVisible(
                field
              )

          };

        }
      );


  /*
   * =================================================
   * FORMS
   * =================================================
   */

  const forms =
    Array.from(
      document.forms
    )
      .map(
        form => ({

          action:
            getRelativePath(
              form.action
            ),

          method:
            (
              form.method ||
              "get"
            )
              .toUpperCase(),

          fieldCount:
            form.querySelectorAll(
              "input, select, textarea"
            )
              .length

        })
      );


  /*
   * =================================================
   * BREADCRUMBS
   * =================================================
   */

  const breadcrumbSelectors = [

    '[aria-label*="breadcrumb" i]',

    ".breadcrumb",

    ".breadcrumbs",

    '[class*="breadcrumb" i]'

  ];


  let breadcrumbContainer =
    null;


  for (
    const selector
    of breadcrumbSelectors
  ) {

    breadcrumbContainer =
      document.querySelector(
        selector
      );


    if (
      breadcrumbContainer
    ) {
      break;
    }

  }


  let breadcrumbs =
    [];


  if (
    breadcrumbContainer
  ) {

    breadcrumbs =
      Array.from(
        breadcrumbContainer
          .querySelectorAll(
            "a, li"
          )
      )
        .map(
          element =>
            (
              element.innerText ||
              element.textContent ||
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim()
        )
        .filter(Boolean);


    breadcrumbs =
      [
        ...new Set(
          breadcrumbs
        )
      ];

  }


  /*
   * =================================================
   * NAVIGATION
   * =================================================
   */

  const navigation =
    Array.from(
      document.querySelectorAll(
        `
        nav a,
        header a,
        [role="navigation"] a
        `
      )
    )
      .filter(
        link =>
          isVisible(
            link
          )
      )
      .map(
        link => ({

          text:
            (
              link.innerText ||
              link.textContent ||
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim(),

          path:
            getRelativePath(
              link.href
            )

        })
      )
      .filter(
        item =>
          item.text
      );


  const uniqueNavigation =
    navigation.filter(
      (
        item,
        index,
        array
      ) =>

        array.findIndex(
          candidate =>
            candidate.text ===
              item.text &&
            candidate.path ===
              item.path
        ) === index

    );


  /*
   * =================================================
   * META DESCRIPTION
   * =================================================
   */

  const metaDescription =
    document.querySelector(
      'meta[name="description"]'
    )
      ?.getAttribute(
        "content"
      )
      ?.trim() ||
    "";


  /*
   * =================================================
   * BODY TEXT
   * =================================================
   */

  const bodyText =
    (
      document.body
        ?.innerText ||
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  /*
   * =================================================
   * PHASE 3
   * FONT FAMILIES
   * =================================================
   */

  const fonts =
    [];


  try {

    for (
      const fontFace
      of document.fonts
    ) {

      fonts.push({

        family:
          String(
            fontFace.family ||
            ""
          )
            .replace(
              /["']/g,
              ""
            )
            .trim(),

        style:
          fontFace.style ||
          "normal",

        weight:
          fontFace.weight ||
          "normal",

        stretch:
          fontFace.stretch ||
          "normal",

        status:
          fontFace.status ||
          "unknown"

      });

    }

  }

  catch (error) {

    console.warn(
      "Unable to inspect document fonts:",
      error
    );

  }


  /*
   * Remove duplicate font faces.
   */

  const uniqueFonts =
    fonts.filter(
      (
        font,
        index,
        array
      ) =>

        array.findIndex(
          candidate =>
            candidate.family ===
              font.family &&
            candidate.style ===
              font.style &&
            candidate.weight ===
              font.weight
        ) === index

    );


  /*
   * =================================================
   * PHASE 3
   * FONT RESOURCE FILES
   * =================================================
   */

  const fontResources =
    [];


  try {

    const resources =
      performance
        .getEntriesByType(
          "resource"
        );


    resources.forEach(
      resource => {

        const resourceUrl =
          resource.name ||
          "";


        const cleanUrl =
          resourceUrl
            .split("?")[0]
            .split("#")[0]
            .toLowerCase();


        const isFont =
          /\.(woff2?|ttf|otf|eot)$/i
            .test(
              cleanUrl
            );


        if (
          !isFont
        ) {
          return;
        }


        let relativePath =
          resourceUrl;


        let fileName =
          resourceUrl;


        try {

          const parsed =
            new URL(
              resourceUrl
            );


          relativePath =
            parsed.pathname;


          fileName =
            parsed.pathname
              .split("/")
              .pop() ||
            parsed.pathname;

        }

        catch {

          /*
           * Keep original value.
           */

        }


        fontResources.push({

          url:
            resourceUrl,

          relativePath,

          fileName,

          initiatorType:
            resource.initiatorType ||
            "",

          duration:
            Math.round(
              resource.duration ||
              0
            )

        });

      }
    );

  }

  catch (error) {

    console.warn(
      "Unable to inspect font resources:",
      error
    );

  }


  const uniqueFontResources =
    fontResources.filter(
      (
        font,
        index,
        array
      ) =>

        array.findIndex(
          candidate =>
            candidate.url ===
            font.url
        ) === index

    );


  /*
   * =================================================
   * RETURN
   * =================================================
   */

  return {

    url:
      window.location.href,

    title:
      document.title ||
      "",

    h1:
      document.querySelector(
        "h1"
      )
        ?.innerText
        ?.replace(
          /\s+/g,
          " "
        )
        ?.trim() ||
      "",

    metaDescription,

    links,

    images,

    headings,

    buttons,

    formFields,

    forms,

    breadcrumbs,

    navigation:
      uniqueNavigation,

    bodyText,

    /*
     * Phase 3
     */

    fonts:
      uniqueFonts,

    fontResources:
      uniqueFontResources,

    counts: {

      links:
        links.length,

      visibleLinks:
        links.filter(
          item =>
            item.visible
        )
          .length,

      images:
        images.length,

      visibleImages:
        images.filter(
          item =>
            item.visible
        )
          .length,

      headings:
        headings.length,

      visibleHeadings:
        headings.filter(
          item =>
            item.visible
        )
          .length,

      buttons:
        buttons.length,

      visibleButtons:
        buttons.filter(
          item =>
            item.visible
        )
          .length,

      forms:
        forms.length,

      formFields:
        formFields.length,

      visibleFormFields:
        formFields.filter(
          item =>
            item.visible
        )
          .length,

      navigation:
        uniqueNavigation.length,

      breadcrumbs:
        breadcrumbs.length,

      fonts:
        uniqueFonts.length,

      fontResources:
        uniqueFontResources.length

    },

    timestamp:
      new Date()
        .toISOString()

  };

}


/*
 * =====================================================
 * PHASE 3
 * PAGE HEALTH
 * =====================================================
 */

async function validatePageHealth(
  pageData,
  pageUrl
) {

  const pageOrigin =
    getOrigin(
      pageUrl
    );


  /*
   * =================================================
   * LINKS
   *
   * Visible
   * HTTP(S)
   * Same-origin
   * Unique
   * =================================================
   */

  const linkCandidates =
    uniqueUrls(
      (
        pageData.links ||
        []
      )
        .filter(
          link =>
            link.visible
        )
        .map(
          link =>
            link.href
        )
        .filter(
          url =>
            isCheckableHttpUrl(
              url
            )
        )
        .filter(
          url =>
            getOrigin(
              url
            ) ===
            pageOrigin
        )
    )
      .slice(
        0,
        HEALTH_CONFIG.maxLinksPerPage
      );


  /*
   * =================================================
   * IMAGES
   *
   * Image assets are allowed to come from CDN,
   * therefore not restricted to same origin.
   * =================================================
   */

  const imageCandidates =
    uniqueUrls(
      (
        pageData.images ||
        []
      )
        .filter(
          image =>
            image.visible
        )
        .map(
          image =>
            image.src
        )
        .filter(
          url =>
            isCheckableHttpUrl(
              url
            )
        )
    )
      .slice(
        0,
        HEALTH_CONFIG.maxImagesPerPage
      );


  console.log(
    `Checking ${linkCandidates.length} links and ` +
    `${imageCandidates.length} images for ${pageUrl}`
  );


  /*
   * Run links/images concurrently.
   */

  const [
    linkResults,
    imageResults
  ] =
    await Promise.all([

      runWithConcurrency(
        linkCandidates,
        HEALTH_CONFIG.concurrency,
        url =>
          checkUrlHealth(
            url,
            "link"
          )
      ),

      runWithConcurrency(
        imageCandidates,
        HEALTH_CONFIG.concurrency,
        url =>
          checkUrlHealth(
            url,
            "image"
          )
      )

    ]);


  return {

    links:
      buildHealthSummary(
        linkResults
      ),

    images:
      buildHealthSummary(
        imageResults
      ),

    /*
     * Fonts are compared from what
     * the browser actually loaded.
     */

    fonts: {

      families:
        pageData.fonts ||
        [],

      resources:
        pageData.fontResources ||
        []

    }

  };

}


/*
 * =====================================================
 * CHECK URL
 * =====================================================
 */

async function checkUrlHealth(
  url,
  type
) {

  /*
   * First try HEAD.
   */

  let result =
    await performHealthRequest(
      url,
      "HEAD"
    );


  /*
   * Some servers reject HEAD.
   *
   * 405 = Method Not Allowed
   * 501 = Not Implemented
   *
   * Network/CORS problems may also justify GET.
   */

  if (
    result.status === 405 ||
    result.status === 501 ||
    result.requestFailed
  ) {

    const getResult =
      await performHealthRequest(
        url,
        "GET"
      );


    /*
     * Prefer successful GET result.
     */

    if (
      !getResult.requestFailed ||
      result.requestFailed
    ) {

      result =
        getResult;

    }

  }


  return {

    type,

    url,

    relativePath:
      getComparablePath(
        url
      ),

    fileName:
      getFileName(
        url
      ),

    ...result

  };

}


/*
 * =====================================================
 * PERFORM HTTP REQUEST
 * =====================================================
 */

async function performHealthRequest(
  url,
  method
) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => {

        controller.abort();

      },
      HEALTH_CONFIG.timeoutMs
    );


  try {

    const response =
      await fetch(
        url,
        {

          method,

          /*
           * Follow redirect so we know
           * the final destination.
           */

          redirect:
            "follow",

          /*
           * Helps authenticated apps where
           * browser policies permit cookies.
           */

          credentials:
            "include",

          cache:
            "no-store",

          signal:
            controller.signal

        }
      );


    clearTimeout(
      timeout
    );


    const classification =
      classifyStatus(
        response.status
      );


    return {

      method,

      status:
        response.status,

      statusText:
        response.statusText ||
        "",

      classification,

      ok:
        classification ===
        "working",

      broken:
        classification ===
          "broken" ||
        classification ===
          "server-error",

      protected:
        classification ===
        "protected",

      redirected:
        response.redirected,

      finalUrl:
        response.url ||
        url,

      requestFailed:
        false,

      error:
        ""

    };

  }

  catch (error) {

    clearTimeout(
      timeout
    );


    return {

      method,

      status:
        0,

      statusText:
        "",

      classification:
        error.name ===
        "AbortError"
          ? "timeout"
          : "failed",

      ok:
        false,

      broken:
        false,

      protected:
        false,

      redirected:
        false,

      finalUrl:
        "",

      requestFailed:
        true,

      error:
        error.name ===
        "AbortError"
          ? "Request timed out"
          : (
              error.message ||
              "Request failed"
            )

    };

  }

}


/*
 * =====================================================
 * STATUS CLASSIFICATION
 * =====================================================
 */

function classifyStatus(
  status
) {

  if (
    status >= 200 &&
    status <= 299
  ) {

    return "working";

  }


  if (
    status >= 300 &&
    status <= 399
  ) {

    return "redirect";

  }


  /*
   * Avoid calling authentication failures
   * broken links.
   */

  if (
    status === 401 ||
    status === 403
  ) {

    return "protected";

  }


  if (
    status >= 400 &&
    status <= 499
  ) {

    return "broken";

  }


  if (
    status >= 500 &&
    status <= 599
  ) {

    return "server-error";

  }


  return "unknown";

}


/*
 * =====================================================
 * HEALTH SUMMARY
 * =====================================================
 */

function buildHealthSummary(
  results = []
) {

  return {

    checked:
      results.length,

    working:
      results.filter(
        item =>
          item.classification ===
          "working"
      )
        .length,

    redirects:
      results.filter(
        item =>
          item.redirected ||
          item.classification ===
          "redirect"
      )
        .length,

    broken:
      results.filter(
        item =>
          item.classification ===
            "broken" ||
          item.classification ===
            "server-error"
      )
        .length,

    protected:
      results.filter(
        item =>
          item.classification ===
          "protected"
      )
        .length,

    failed:
      results.filter(
        item =>
          item.requestFailed
      )
        .length,

    results

  };

}


/*
 * =====================================================
 * PHASE 3
 * COMPARE HEALTH
 * =====================================================
 */

function compareHealthResults(
  source,
  target
) {

  return {

    /*
     * =================================================
     * LINK HEALTH
     * =================================================
     */

    links:
      compareUrlHealthCollections(
        source.links?.results ||
        [],

        target.links?.results ||
        []
      ),


    /*
     * =================================================
     * IMAGE HEALTH
     * =================================================
     */

    images:
      compareUrlHealthCollections(
        source.images?.results ||
        [],

        target.images?.results ||
        []
      ),


    /*
     * =================================================
     * FONT FAMILY COMPARISON
     * =================================================
     */

    fonts:
      compareFonts(
        source.fonts,
        target.fonts
      )

  };

}


/*
 * =====================================================
 * COMPARE LINK/IMAGE HEALTH
 * =====================================================
 */

function compareUrlHealthCollections(
  sourceResults = [],
  targetResults = []
) {

  const sourceBroken =
    sourceResults.filter(
      item =>
        item.broken
    );


  const targetBroken =
    targetResults.filter(
      item =>
        item.broken
    );


  const brokenOnlyInSource =
    sourceBroken.filter(
      sourceItem =>

        !targetBroken.some(
          targetItem =>

            targetItem.relativePath ===
            sourceItem.relativePath

        )
    );


  const brokenOnlyInTarget =
    targetBroken.filter(
      targetItem =>

        !sourceBroken.some(
          sourceItem =>

            sourceItem.relativePath ===
            targetItem.relativePath

        )
    );


  /*
   * Same comparable path but
   * different HTTP health/status.
   */

  const statusDifferences =
    [];


  sourceResults.forEach(
    sourceItem => {

      const targetItem =
        targetResults.find(
          item =>
            item.relativePath ===
            sourceItem.relativePath
        );


      if (
        !targetItem
      ) {
        return;
      }


      if (
        sourceItem.status !==
          targetItem.status ||

        sourceItem.classification !==
          targetItem.classification ||

        sourceItem.redirected !==
          targetItem.redirected
      ) {

        statusDifferences.push({

          path:
            sourceItem.relativePath,

          source: {

            status:
              sourceItem.status,

            classification:
              sourceItem.classification,

            redirected:
              sourceItem.redirected,

            finalUrl:
              sourceItem.finalUrl

          },

          target: {

            status:
              targetItem.status,

            classification:
              targetItem.classification,

            redirected:
              targetItem.redirected,

            finalUrl:
              targetItem.finalUrl

          }

        });

      }

    }
  );


  return {

    brokenOnlyInSource,

    brokenOnlyInTarget,

    statusDifferences,

    match:

      brokenOnlyInSource.length ===
        0 &&

      brokenOnlyInTarget.length ===
        0 &&

      statusDifferences.length ===
        0

  };

}


/*
 * =====================================================
 * FONT COMPARISON
 * =====================================================
 */

function compareFonts(
  sourceFonts = {},
  targetFonts = {}
) {

  const sourceFamilies =
    normalizeFontFamilies(
      sourceFonts.families ||
      []
    );


  const targetFamilies =
    normalizeFontFamilies(
      targetFonts.families ||
      []
    );


  const sourceResources =
    normalizeFontResources(
      sourceFonts.resources ||
      []
    );


  const targetResources =
    normalizeFontResources(
      targetFonts.resources ||
      []
    );


  const missingFamiliesInTarget =
    sourceFamilies.filter(
      sourceFont =>

        !targetFamilies.some(
          targetFont =>

            targetFont.family ===
              sourceFont.family &&

            targetFont.weight ===
              sourceFont.weight &&

            targetFont.style ===
              sourceFont.style

        )
    );


  const extraFamiliesInTarget =
    targetFamilies.filter(
      targetFont =>

        !sourceFamilies.some(
          sourceFont =>

            sourceFont.family ===
              targetFont.family &&

            sourceFont.weight ===
              targetFont.weight &&

            sourceFont.style ===
              targetFont.style

        )
    );


  const missingFilesInTarget =
    sourceResources.filter(
      sourceFont =>

        !targetResources.some(
          targetFont =>

            targetFont.fileName ===
            sourceFont.fileName

        )
    );


  const extraFilesInTarget =
    targetResources.filter(
      targetFont =>

        !sourceResources.some(
          sourceFont =>

            sourceFont.fileName ===
            targetFont.fileName

        )
    );


  return {

    sourceFamilyCount:
      sourceFamilies.length,

    targetFamilyCount:
      targetFamilies.length,

    sourceFileCount:
      sourceResources.length,

    targetFileCount:
      targetResources.length,

    missingFamiliesInTarget,

    extraFamiliesInTarget,

    missingFilesInTarget,

    extraFilesInTarget,

    match:

      missingFamiliesInTarget.length ===
        0 &&

      extraFamiliesInTarget.length ===
        0 &&

      missingFilesInTarget.length ===
        0 &&

      extraFilesInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * NORMALIZE FONT FAMILIES
 * =====================================================
 */

function normalizeFontFamilies(
  fonts = []
) {

  const normalized =
    fonts
      .map(
        font => ({

          family:
            normalizeText(
              font.family
            ),

          weight:
            normalizeText(
              font.weight
            ),

          style:
            normalizeText(
              font.style
            ),

          status:
            normalizeText(
              font.status
            )

        })
      )
      .filter(
        font =>
          font.family
      );


  return uniqueObjects(
    normalized
  );

}


/*
 * =====================================================
 * NORMALIZE FONT FILES
 * =====================================================
 */

function normalizeFontResources(
  resources = []
) {

  const normalized =
    resources
      .map(
        resource => ({

          fileName:
            normalizeText(
              resource.fileName
            ),

          path:
            normalizePath(
              resource.relativePath
            ),

          url:
            resource.url ||
            "",

          duration:
            resource.duration ||
            0

        })
      )
      .filter(
        resource =>
          resource.fileName
      );


  return uniqueObjectsBy(
    normalized,
    item =>
      item.fileName
  );

}


/*
 * =====================================================
 * PHASE 2
 * COMPARE PAGE DATA
 * =====================================================
 */

function comparePageData(
  source,
  target
) {

  source =
    source ||
    {};

  target =
    target ||
    {};


  const sourceLinks =
    source.links ||
    [];

  const targetLinks =
    target.links ||
    [];


  const sourceImages =
    source.images ||
    [];

  const targetImages =
    target.images ||
    [];


  const sourceButtons =
    source.buttons ||
    [];

  const targetButtons =
    target.buttons ||
    [];


  const sourceHeadings =
    source.headings ||
    [];

  const targetHeadings =
    target.headings ||
    [];


  const sourceFormFields =
    source.formFields ||
    [];

  const targetFormFields =
    target.formFields ||
    [];


  const sourceForms =
    source.forms ||
    [];

  const targetForms =
    target.forms ||
    [];


  const sourceNavigation =
    source.navigation ||
    [];

  const targetNavigation =
    target.navigation ||
    [];


  const sourceBreadcrumbs =
    source.breadcrumbs ||
    [];

  const targetBreadcrumbs =
    target.breadcrumbs ||
    [];


  return {

    titleMatch:

      normalizeText(
        source.title
      ) ===

      normalizeText(
        target.title
      ),


    h1Match:

      normalizeText(
        source.h1
      ) ===

      normalizeText(
        target.h1
      ),


    metaDescriptionMatch:

      normalizeText(
        source.metaDescription
      ) ===

      normalizeText(
        target.metaDescription
      ),


    bodyTextMatch:

      normalizeText(
        source.bodyText
      ) ===

      normalizeText(
        target.bodyText
      ),


    links:

      compareLinks(
        sourceLinks,
        targetLinks
      ),


    images:

      compareImages(
        sourceImages,
        targetImages
      ),


    buttons:

      compareButtons(
        sourceButtons,
        targetButtons
      ),


    headings:

      compareHeadings(
        sourceHeadings,
        targetHeadings
      ),


    formFields:

      compareFormFields(
        sourceFormFields,
        targetFormFields
      ),


    forms:

      compareForms(
        sourceForms,
        targetForms
      ),


    navigation:

      compareNavigation(
        sourceNavigation,
        targetNavigation
      ),


    breadcrumbs: {

      source:
        sourceBreadcrumbs,

      target:
        targetBreadcrumbs,

      missingInTarget:
        arrayDifference(
          normalizeStringArray(
            sourceBreadcrumbs
          ),
          normalizeStringArray(
            targetBreadcrumbs
          )
        ),

      extraInTarget:
        arrayDifference(
          normalizeStringArray(
            targetBreadcrumbs
          ),
          normalizeStringArray(
            sourceBreadcrumbs
          )
        ),

      match:

        arraysEqual(
          normalizeStringArray(
            sourceBreadcrumbs
          ),
          normalizeStringArray(
            targetBreadcrumbs
          )
        )

    },


    counts: {

      linksMatch:

        sourceLinks.length ===
        targetLinks.length,


      imagesMatch:

        sourceImages.length ===
        targetImages.length,


      headingsMatch:

        sourceHeadings.length ===
        targetHeadings.length,


      buttonsMatch:

        sourceButtons.length ===
        targetButtons.length,


      formsMatch:

        sourceForms.length ===
        targetForms.length,


      formFieldsMatch:

        sourceFormFields.length ===
        targetFormFields.length,


      navigationMatch:

        sourceNavigation.length ===
        targetNavigation.length,


      breadcrumbsMatch:

        sourceBreadcrumbs.length ===
        targetBreadcrumbs.length

    }

  };

}


/*
 * =====================================================
 * PHASE 2
 * LINKS
 * =====================================================
 */

function compareLinks(
  source = [],
  target = []
) {

  const sourceValues =
    source
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          text:
            normalizeText(
              item.text
            ),

          path:
            normalizePath(
              item.relativePath
            )

        })
      );


  const targetValues =
    target
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          text:
            normalizeText(
              item.text
            ),

          path:
            normalizePath(
              item.relativePath
            )

        })
      );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            targetItem.text ===
              sourceItem.text &&

            targetItem.path ===
              sourceItem.path

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            sourceItem.text ===
              targetItem.text &&

            sourceItem.path ===
              targetItem.path

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * PHASE 2
 * IMAGES
 * =====================================================
 */

function compareImages(
  source = [],
  target = []
) {

  const sourceValues =
    source
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          alt:
            normalizeText(
              item.alt
            ),

          fileName:
            normalizeText(
              item.fileName
            )

        })
      );


  const targetValues =
    target
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          alt:
            normalizeText(
              item.alt
            ),

          fileName:
            normalizeText(
              item.fileName
            )

        })
      );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            targetItem.alt ===
              sourceItem.alt &&

            targetItem.fileName ===
              sourceItem.fileName

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            sourceItem.alt ===
              targetItem.alt &&

            sourceItem.fileName ===
              targetItem.fileName

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * PHASE 2
 * BUTTONS
 * =====================================================
 */

function compareButtons(
  source = [],
  target = []
) {

  const sourceValues =
    source
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          text:
            normalizeText(
              item.text
            ),

          disabled:
            !!item.disabled

        })
      );


  const targetValues =
    target
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          text:
            normalizeText(
              item.text
            ),

          disabled:
            !!item.disabled

        })
      );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            targetItem.text ===
              sourceItem.text &&

            targetItem.disabled ===
              sourceItem.disabled

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            sourceItem.text ===
              targetItem.text &&

            sourceItem.disabled ===
              targetItem.disabled

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * PHASE 2
 * HEADINGS
 * =====================================================
 */

function compareHeadings(
  source = [],
  target = []
) {

  const sourceValues =
    source
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          tag:
            item.tag ||
            "",

          text:
            normalizeText(
              item.text
            )

        })
      );


  const targetValues =
    target
      .filter(
        item =>
          item.visible
      )
      .map(
        item => ({

          tag:
            item.tag ||
            "",

          text:
            normalizeText(
              item.text
            )

        })
      );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            targetItem.tag ===
              sourceItem.tag &&

            targetItem.text ===
              sourceItem.text

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            sourceItem.tag ===
              targetItem.tag &&

            sourceItem.text ===
              targetItem.text

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * PHASE 2
 * FORM FIELDS
 * =====================================================
 */

function compareFormFields(
  source = [],
  target = []
) {

  const sourceValues =
    source
      .filter(
        item =>
          item.visible
      )
      .map(
        normalizeFormField
      );


  const targetValues =
    target
      .filter(
        item =>
          item.visible
      )
      .map(
        normalizeFormField
      );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            JSON.stringify(
              targetItem
            ) ===

            JSON.stringify(
              sourceItem
            )

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            JSON.stringify(
              sourceItem
            ) ===

            JSON.stringify(
              targetItem
            )

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * PHASE 2
 * FORMS
 * =====================================================
 */

function compareForms(
  source = [],
  target = []
) {

  const normalizeForm =
    form => ({

      action:
        normalizePath(
          form.action
        ),

      method:
        normalizeText(
          form.method
        ),

      fieldCount:
        Number(
          form.fieldCount ||
          0
        )

    });


  const sourceValues =
    source.map(
      normalizeForm
    );


  const targetValues =
    target.map(
      normalizeForm
    );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            JSON.stringify(
              sourceItem
            ) ===

            JSON.stringify(
              targetItem
            )

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            JSON.stringify(
              sourceItem
            ) ===

            JSON.stringify(
              targetItem
            )

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * PHASE 2
 * NAVIGATION
 * =====================================================
 */

function compareNavigation(
  source = [],
  target = []
) {

  const sourceValues =
    source.map(
      item => ({

        text:
          normalizeText(
            item.text
          ),

        path:
          normalizePath(
            item.path
          )

      })
    );


  const targetValues =
    target.map(
      item => ({

        text:
          normalizeText(
            item.text
          ),

        path:
          normalizePath(
            item.path
          )

      })
    );


  const missingInTarget =
    sourceValues.filter(
      sourceItem =>

        !targetValues.some(
          targetItem =>

            targetItem.text ===
              sourceItem.text &&

            targetItem.path ===
              sourceItem.path

        )
    );


  const extraInTarget =
    targetValues.filter(
      targetItem =>

        !sourceValues.some(
          sourceItem =>

            sourceItem.text ===
              targetItem.text &&

            sourceItem.path ===
              targetItem.path

        )
    );


  return {

    sourceCount:
      sourceValues.length,

    targetCount:
      targetValues.length,

    missingInTarget:
      uniqueObjects(
        missingInTarget
      ),

    extraInTarget:
      uniqueObjects(
        extraInTarget
      ),

    match:

      missingInTarget.length ===
        0 &&

      extraInTarget.length ===
        0

  };

}


/*
 * =====================================================
 * NORMALIZE FORM FIELD
 * =====================================================
 */

function normalizeFormField(
  field = {}
) {

  return {

    tag:
      field.tag ||
      "",

    type:
      normalizeText(
        field.type
      ),

    name:
      normalizeText(
        field.name
      ),

    label:
      normalizeText(
        field.label
      ),

    placeholder:
      normalizeText(
        field.placeholder
      ),

    required:
      !!field.required,

    disabled:
      !!field.disabled,

    options:
      normalizeStringArray(
        field.options
      )

  };

}


/*
 * =====================================================
 * GENERIC HELPERS
 * =====================================================
 */

function normalizeText(
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


/*
 * =====================================================
 * NORMALIZE URL/PATH
 * =====================================================
 */

function normalizePath(
  value
) {

  if (
    !value
  ) {
    return "";
  }


  try {

    if (
      /^https?:\/\//i.test(
        value
      )
    ) {

      const parsed =
        new URL(
          value
        );


      value =
        parsed.pathname +
        parsed.search +
        parsed.hash;

    }

  }

  catch {

    /*
     * Keep original.
     */

  }


  let normalized =
    String(
      value
    )
      .trim()
      .toLowerCase();


  if (
    normalized.length > 1
  ) {

    normalized =
      normalized.replace(
        /\/+$/,
        ""
      );

  }


  return normalized;

}


/*
 * =====================================================
 * URL COMPARABLE PATH
 * =====================================================
 */

function getComparablePath(
  url
) {

  try {

    const parsed =
      new URL(
        url
      );


    return normalizePath(
      parsed.pathname +
      parsed.search
    );

  }

  catch {

    return normalizePath(
      url
    );

  }

}


/*
 * =====================================================
 * URL ORIGIN
 * =====================================================
 */

function getOrigin(
  url
) {

  try {

    return new URL(
      url
    )
      .origin
      .toLowerCase();

  }

  catch {

    return "";

  }

}


/*
 * =====================================================
 * FILE NAME
 * =====================================================
 */

function getFileName(
  url
) {

  try {

    return new URL(
      url
    )
      .pathname
      .split("/")
      .pop() ||
      "";

  }

  catch {

    return "";

  }

}


/*
 * =====================================================
 * CHECK URL TYPE
 * =====================================================
 */

function isCheckableHttpUrl(
  url
) {

  if (
    !url
  ) {
    return false;
  }


  const value =
    String(
      url
    )
      .trim()
      .toLowerCase();


  if (
    value.startsWith(
      "mailto:"
    ) ||
    value.startsWith(
      "tel:"
    ) ||
    value.startsWith(
      "javascript:"
    ) ||
    value.startsWith(
      "data:"
    ) ||
    value.startsWith(
      "blob:"
    ) ||
    value === "#" ||
    value.startsWith(
      "#"
    )
  ) {

    return false;

  }


  return (
    value.startsWith(
      "http://"
    ) ||
    value.startsWith(
      "https://"
    )
  );

}


/*
 * =====================================================
 * UNIQUE URLS
 * =====================================================
 */

function uniqueUrls(
  urls = []
) {

  return [
    ...new Set(
      urls
        .map(
          url =>
            String(
              url ||
              ""
            )
              .trim()
        )
        .filter(Boolean)
    )
  ];

}


/*
 * =====================================================
 * STRING ARRAY
 * =====================================================
 */

function normalizeStringArray(
  values = []
) {

  return values
    .map(
      normalizeText
    )
    .filter(Boolean);

}


/*
 * =====================================================
 * ARRAY EQUALITY
 * =====================================================
 */

function arraysEqual(
  first = [],
  second = []
) {

  return (

    first.length ===
      second.length &&

    first.every(
      (
        value,
        index
      ) =>

        value ===
        second[index]

    )

  );

}


/*
 * =====================================================
 * ARRAY DIFFERENCE
 * =====================================================
 */

function arrayDifference(
  source = [],
  target = []
) {

  return [
    ...new Set(
      source.filter(
        item =>
          !target.includes(
            item
          )
      )
    )
  ];

}


/*
 * =====================================================
 * UNIQUE OBJECTS
 * =====================================================
 */

function uniqueObjects(
  values = []
) {

  const seen =
    new Set();


  return values.filter(
    item => {

      const key =
        JSON.stringify(
          item
        );


      if (
        seen.has(
          key
        )
      ) {

        return false;

      }


      seen.add(
        key
      );


      return true;

    }
  );

}


/*
 * =====================================================
 * UNIQUE OBJECTS BY KEY
 * =====================================================
 */

function uniqueObjectsBy(
  values = [],
  keyFunction
) {

  const seen =
    new Set();


  return values.filter(
    item => {

      const key =
        keyFunction(
          item
        );


      if (
        seen.has(
          key
        )
      ) {

        return false;

      }


      seen.add(
        key
      );


      return true;

    }
  );

}


/*
 * =====================================================
 * CONCURRENCY WORKER
 * =====================================================
 */

async function runWithConcurrency(
  items,
  concurrency,
  worker
) {

  const results =
    new Array(
      items.length
    );


  let nextIndex =
    0;


  async function runner() {

    while (
      true
    ) {

      const currentIndex =
        nextIndex++;


      if (
        currentIndex >=
        items.length
      ) {

        return;

      }


      try {

        results[currentIndex] =
          await worker(
            items[currentIndex]
          );

      }

      catch (error) {

        results[currentIndex] = {

          url:
            items[currentIndex],

          status:
            0,

          classification:
            "failed",

          requestFailed:
            true,

          broken:
            false,

          redirected:
            false,

          protected:
            false,

          error:
            error.message ||
            "Health check failed"

        };

      }

    }

  }


  const workerCount =
    Math.min(
      concurrency,
      items.length
    );


  const workers =
    [];


  for (
    let index = 0;
    index < workerCount;
    index++
  ) {

    workers.push(
      runner()
    );

  }


  await Promise.all(
    workers
  );


  return results;

}


/*
 * =====================================================
 * WAIT FOR TARGET TAB
 * =====================================================
 */

async function waitForTabToLoad(
  tabId
) {

  const existingTab =
    await chrome.tabs.get(
      tabId
    );


  if (
    existingTab.status ===
    "complete"
  ) {

    return;

  }


  return new Promise(
    (
      resolve,
      reject
    ) => {


      let listener =
        null;


      const cleanup =
        () => {

          if (
            listener
          ) {

            chrome.tabs
              .onUpdated
              .removeListener(
                listener
              );

          }

        };


      const timeout =
        setTimeout(
          () => {

            cleanup();


            reject(
              new Error(
                "Target page took too long to load."
              )
            );

          },
          30000
        );


      listener =
        (
          updatedTabId,
          changeInfo
        ) => {

          if (
            updatedTabId ===
              tabId &&

            changeInfo.status ===
              "complete"
          ) {

            clearTimeout(
              timeout
            );


            cleanup();


            resolve();

          }

        };


      chrome.tabs
        .onUpdated
        .addListener(
          listener
        );

    }
  );

}


/*
 * =====================================================
 * DELAY
 * =====================================================
 */

function sleep(
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