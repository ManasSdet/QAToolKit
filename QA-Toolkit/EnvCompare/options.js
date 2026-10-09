document.addEventListener("DOMContentLoaded", loadSettings);

document
  .getElementById("saveBtn")
  .addEventListener("click", saveSettings);

async function loadSettings() {

  const data = await chrome.storage.local.get([
    "projectName",
    "environments"
  ]);

  document.getElementById("projectName").value =
    data.projectName || "";

  const envs = data.environments || {};

  document.getElementById("stageUrl").value =
    envs.STAGE || "";

  document.getElementById("uatUrl").value =
    envs.UAT || "";

  document.getElementById("sitUrl").value =
    envs.SIT || "";

  document.getElementById("prodUrl").value =
    envs.PROD || "";
}

async function saveSettings() {

  const projectName =
    document
      .getElementById("projectName")
      .value
      .trim();

  const environments = {
    STAGE: cleanUrl(
      document
        .getElementById("stageUrl")
        .value
    ),

    UAT: cleanUrl(
      document
        .getElementById("uatUrl")
        .value
    ),

    SIT: cleanUrl(
      document
        .getElementById("sitUrl")
        .value
    ),

    PROD: cleanUrl(
      document
        .getElementById("prodUrl")
        .value
    )
  };

  await chrome.storage.local.set({
    projectName,
    environments
  });

  const status =
    document.getElementById("status");

  status.textContent =
    "Settings saved successfully.";

  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function cleanUrl(url) {

  let value = url.trim();

  if (!value) {
    return "";
  }

  return value.replace(/\/$/, "");
}