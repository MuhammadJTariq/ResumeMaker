const templatesPageGrid = document.getElementById("templates-page-grid");

async function createResumeForTemplate(templateId) {
  const resumeId = `RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const emptyResume = {
    id: resumeId,
    userId: null,
    templateId,
    title: "Untitled Resume",
    status: "Step 1 of 5",
    payload: {
      id: resumeId,
      templateId,
      title: "Untitled Resume",
      updatedAt: "Just created",
      status: "Step 1 of 5",
      completedSteps: [false, false, false, false, false],
      personal: {
        introduction: "",
        firstName: "",
        lastName: "",
        email: "",
        address: "",
        cityCountry: "",
        phone: "",
        links: [""],
      },
      experience: [{ title: "", subtitle: "", description: "", dateStarted: "", dateEnded: "" }],
      education: [{ title: "", degreeType: "Bachelors", startDate: "", endDate: "", address: "" }],
      skills: [],
    },
  };

  const response = await fetch("/api/resumes", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emptyResume),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to create resume.");
  }

  return resumeId;
}

async function chooseTemplate(templateId) {
  const selectResponse = await fetch("/api/templates/select", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ templateId }),
  });
  const selectData = await selectResponse.json();

  if (!selectResponse.ok) {
    throw new Error(selectData.message || "Failed to choose template.");
  }

  const resumeId = await createResumeForTemplate(templateId);
  window.location.href = `/?resume=${encodeURIComponent(resumeId)}&template=${encodeURIComponent(templateId)}`;
}

async function loadTemplatesPage() {
  templatesPageGrid.innerHTML = "<p>Loading templates...</p>";

  try {
    const response = await fetch("/api/templates/previews", {
      credentials: "same-origin",
    });
    const templates = await response.json();

    if (!response.ok) {
      throw new Error(templates.message || "Failed to load templates.");
    }

    templatesPageGrid.innerHTML = templates
      .map(
        (template) => `
          <article class="template-gallery-card" data-template-id="${template.template_id}">
            <img src="${template.preview_image_url}" alt="${template.name} preview" />
            <div class="template-gallery-body">
              <h3>${template.name}</h3>
              <p>Template ID: ${template.template_id}</p>
              <button class="primary-action" type="button" data-choose-template="${template.template_id}">
                Choose This Template
              </button>
            </div>
          </article>
        `
      )
      .join("");

    templatesPageGrid.querySelectorAll("[data-choose-template]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const templateId = event.target.dataset.chooseTemplate;
        event.target.disabled = true;
        event.target.textContent = "Choosing...";

        try {
          await chooseTemplate(templateId);
        } catch (error) {
          event.target.disabled = false;
          event.target.textContent = "Choose This Template";
          window.alert(error.message);
        }
      });
    });
  } catch (error) {
    templatesPageGrid.innerHTML = `<p>${error.message}</p>`;
  }
}

loadTemplatesPage();
