

const backHomeButton = document.getElementById("back-home-button");
const accountFields = document.getElementById("account-fields");
const deactivateAccountButton = document.getElementById("deactivate-account-button");
const deleteAccountButton = document.getElementById("delete-account-button");
const accountStatusMessage = document.getElementById("account-status-message");

const appState = {
  user: null,
};

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();

    if (response.redirected || text.includes("<!DOCTYPE")) {
      window.location.href = "/login";
      throw new Error("Redirecting to login.");
    }

    throw new Error("Server returned a non-JSON response.");
  }

  return response.json();
}

const fieldConfig = [
  { key: "name", label: "Name", type: "text" },
  { key: "profile", label: "Profile", type: "text" },
  { key: "id", label: "Id", type: "text", readonly: true },
  { key: "address", label: "Address", type: "text" },
  { key: "subscription", label: "Subscription", type: "text" },
  { key: "account", label: "Account", type: "text" },
];

function renderFields() {
  if (!appState.user) {
    return;
  }

  accountFields.innerHTML = fieldConfig
    .map(
      (field) => `
        <article class="account-field-row">
          <div class="account-field-copy">
            <h2>${field.label}</h2>
          </div>
          <div class="account-field-inputs">
            <input
              class="account-input"
              id="field-${field.key}"
              type="${field.type}"
              value="${appState.user[field.key] || ""}"
              ${field.readonly ? "readonly" : ""}
            />
            ${field.readonly ? "" : `<button class="primary-action save-field-button" type="button" data-save-field="${field.key}">Save</button>`}
          </div>
        </article>
      `
    )
    .join("");

  bindFieldEvents();
  accountStatusMessage.textContent = `Account is ${String(appState.user.account || "Active").toLowerCase()}.`;
}

async function loadAccountSettings() {
  try {
    const response = await fetch("/api/account-settings", {
      credentials: "same-origin",
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "Failed to load account settings.");
    }

    appState.user = data;
    renderFields();
  } catch (error) {
    accountStatusMessage.textContent = error.message;
  }
}

async function persistAccountSettings(nextUser) {
  const response = await fetch("/api/account-settings", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: nextUser.name,
      profile: nextUser.profile,
      address: nextUser.address,
      subscription: nextUser.subscription,
      account: nextUser.account,
    }),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || "Failed to save account settings.");
  }

  appState.user = data.accountSettings;
  renderFields();
}

function bindFieldEvents() {
  document.querySelectorAll("[data-save-field]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const field = event.target.dataset.saveField;
      const input = document.getElementById(`field-${field}`);
      const nextUser = {
        ...appState.user,
        [field]: input.value.trim(),
      };

      try {
        accountStatusMessage.textContent = `Saving ${field}...`;
        await persistAccountSettings(nextUser);
        accountStatusMessage.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)} saved.`;
      } catch (error) {
        accountStatusMessage.textContent = error.message;
      }
    });
  });
}

backHomeButton.addEventListener("click", () => {
  window.location.href = "/";
});

deactivateAccountButton.addEventListener("click", async () => {
  if (!appState.user) {
    return;
  }

  try {
    await persistAccountSettings({
      ...appState.user,
      account: "Deactivated",
    });
    accountStatusMessage.textContent = "Account has been deactivated.";
  } catch (error) {
    accountStatusMessage.textContent = error.message;
  }
});

deleteAccountButton.addEventListener("click", async () => {
  accountStatusMessage.textContent = "Delete is not wired to hard-delete yet.";
});

loadAccountSettings();
