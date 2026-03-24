const STORAGE_KEY = "resume-maker-app-state";

const sampleRecentResumes = [
  { title: "Product Designer Resume", updatedAt: "Edited 2 hours ago", status: "Ready to export", sample: true },
  { title: "Marketing Manager Resume", updatedAt: "Edited yesterday", status: "Needs review", sample: true },
  { title: "Software Engineer Resume", updatedAt: "Edited 3 days ago", status: "Tailored draft", sample: true },
];

const steps = [
  { key: "personal", title: "Personal Details" },
  { key: "experience", title: "Experience" },
  { key: "education", title: "Education" },
  { key: "skills", title: "Skills" },
  { key: "about", title: "About Yourself" },
];

const dashboardPage = document.getElementById("dashboard-page");
const resumePage = document.getElementById("resume-page");
const resumeList = document.getElementById("resume-list");
const createResumeButton = document.getElementById("create-resume-button");
const resumeModal = document.getElementById("resume-modal");
const closeModalButton = document.getElementById("close-modal-button");
const modalBackdrop = document.getElementById("modal-backdrop");
const templateModal = document.getElementById("template-modal");
const templateModalBackdrop = document.getElementById("template-modal-backdrop");
const closeTemplateModalButton = document.getElementById("close-template-modal-button");
const chooseTemplateButton = document.getElementById("choose-template-button");
const templateGrid = document.getElementById("template-grid");
const stepper = document.getElementById("stepper");
const stepContent = document.getElementById("step-content");
const nextButton = document.getElementById("next-button");
const backButton = document.getElementById("back-button");
const resumeIdCopy = document.getElementById("resume-id-copy");
const backToDashboardButton = document.getElementById("back-to-dashboard");
const resumePreview = document.getElementById("resume-preview");
const resumeEditor = document.getElementById("resume-editor");
const resumePageId = document.getElementById("resume-page-id");
const downloadPdfButton = document.getElementById("download-pdf-button");
const downloadStatus = document.getElementById("download-status");
const dashboardProfileMenu = document.getElementById("dashboard-profile-menu");
const dashboardProfileTrigger = document.getElementById("dashboard-profile-trigger");
const dashboardProfileDropdown = document.getElementById("dashboard-profile-dropdown");
const accountSettingsButton = document.getElementById("account-settings-button");
const logoutButton = document.getElementById("logout-button");
const dashboardProfileName = document.getElementById("dashboard-profile-name");
const dashboardProfilePlan = document.getElementById("dashboard-profile-plan");

const appState = {
  resumes: loadStoredResumes(),
  activeResume: null,
  activeStep: 0,
  routeResumeId: null,
  routeTemplateId: null,
  profileMenuOpen: false,
  profileMenuCloseTimer: null,
  templateMap: {},
};

function setProfileMenuOpen(isOpen) {
  if (!dashboardProfileDropdown || !dashboardProfileTrigger) {
    return;
  }

  if (appState.profileMenuCloseTimer) {
    window.clearTimeout(appState.profileMenuCloseTimer);
    appState.profileMenuCloseTimer = null;
  }

  appState.profileMenuOpen = isOpen;
  dashboardProfileDropdown.classList.toggle("hidden", !isOpen);
  dashboardProfileTrigger.setAttribute("aria-expanded", String(isOpen));
}

function loadStoredResumes() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.resumes) ? parsed.resumes : [];
  } catch {
    return [];
  }
}

function saveStoredResumes() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ resumes: appState.resumes }));
}

function createResumeId() {
  return `RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function createResumeObject() {
  return {
    id: createResumeId(),
    templateId: null,
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
  };
}

function cloneResume(resume) {
  return JSON.parse(JSON.stringify(resume));
}

function getResumeById(resumeId) {
  return appState.resumes.find((resume) => resume.id === resumeId) || null;
}

async function fetchResumeById(resumeId) {
  const response = await fetch(`/api/resumes/${resumeId}`, {
    credentials: "same-origin",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load resume.");
  }

  const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
  const resume = {
    ...payload,
    id: data.id,
    templateId: data.template_id || payload.templateId || null,
    title: data.title || payload.title,
    status: data.status || payload.status,
  };

  const existingIndex = appState.resumes.findIndex((item) => item.id === resume.id);
  if (existingIndex === -1) {
    appState.resumes.unshift(resume);
  } else {
    appState.resumes[existingIndex] = resume;
  }

  saveStoredResumes();
  return resume;
}

function updateResumeMeta(resume) {
  const fullName = `${resume.personal.firstName} ${resume.personal.lastName}`.trim();
  const completedCount = resume.completedSteps.filter(Boolean).length;
  resume.title = fullName ? `${fullName} Resume` : "Untitled Resume";
  resume.status = completedCount === 5 ? "Completed" : `Step ${Math.min(completedCount + 1, 5)} of 5`;
  resume.updatedAt = "Updated just now";
}

function generateSummaryFromResume(resume) {
  const fullName = `${resume.personal.firstName} ${resume.personal.lastName}`.trim() || "This candidate";
  const latestExperience = resume.experience[0];
  const latestEducation = resume.education[0];
  const topSkills = resume.skills.slice(0, 4).join(", ");
  const roleText = latestExperience && latestExperience.title ? latestExperience.title : "professional";
  const industryText = latestExperience && latestExperience.subtitle ? ` with experience in ${latestExperience.subtitle}` : "";
  const educationText =
    latestEducation && latestEducation.title
      ? ` Holds ${latestEducation.degreeType.toLowerCase()} education in ${latestEducation.title}.`
      : "";
  const skillsText = topSkills ? ` Key strengths include ${topSkills}.` : "";

  return `${fullName} is a ${roleText}${industryText} based in ${resume.personal.cityCountry}. Brings practical experience from recent roles and a strong foundation for high-impact work.${educationText}${skillsText}`;
}

async function requestSummaryFromLLM(resume) {
  const response = await fetch("/api/llm/resume-summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resume }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "AI summary request failed.");
  }

  return data.text;
}

async function loadSessionUser() {
  try {
    const response = await fetch("/api/session", {
      credentials: "same-origin",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load session user.");
    }

    const fullName = `${data.user.firstName} ${data.user.lastName}`.trim();
    if (dashboardProfileName) {
      dashboardProfileName.textContent = fullName || "User";
    }
    if (dashboardProfilePlan) {
      dashboardProfilePlan.textContent = data.user.email || "Account";
    }
    if (fullName) {
      document.title = `${fullName} | ResumeMaker`;
    }
  } catch (_error) {
    // Auth middleware will handle redirect cases on protected pages.
  }
}

async function persistResumeToServer(resume) {
  const response = await fetch("/api/resumes", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: resume.id,
      templateId: resume.templateId || null,
      title: resume.title,
      status: resume.status,
      payload: resume,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to persist resume.");
  }

  return data;
}

function persistResume(resume) {
  const nextResume = cloneResume(resume);
  const existingIndex = appState.resumes.findIndex((item) => item.id === nextResume.id);

  if (existingIndex === -1) {
    appState.resumes.unshift(nextResume);
  } else {
    appState.resumes[existingIndex] = nextResume;
  }

  saveStoredResumes();
  renderRecentResumes();
}

function formatDateLabel(value) {
  if (!value) {
    return "Present";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function openDashboard(pushHistory = true) {
  dashboardPage.classList.remove("hidden");
  resumePage.classList.add("hidden");
  appState.routeResumeId = null;
  appState.routeTemplateId = null;

  if (pushHistory) {
    window.history.pushState({}, "", window.location.pathname);
  }
}

function openResumeRoute(resumeId, pushHistory = true, templateId = null) {
  const resume = getResumeById(resumeId);
  if (!resume) {
    openDashboard(pushHistory);
    return;
  }

  if (templateId && !resume.templateId) {
    resume.templateId = templateId;
    persistResume(resume);
  }

  dashboardPage.classList.add("hidden");
  resumePage.classList.remove("hidden");
  appState.routeResumeId = resumeId;
  appState.routeTemplateId = templateId || resume.templateId || null;

  if (pushHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set("resume", resumeId);
    if (appState.routeTemplateId) {
      url.searchParams.set("template", appState.routeTemplateId);
    } else {
      url.searchParams.delete("template");
    }
    window.history.pushState({}, "", url.toString());
  }

  renderResumeDetail();
}

function closeResumeBuilder() {
  resumeModal.classList.add("hidden");
  resumeModal.setAttribute("aria-hidden", "true");
  appState.activeResume = null;
  appState.activeStep = 0;
}

function openResumeBuilder() {
  appState.activeResume = createResumeObject();
  appState.activeStep = 0;
  resumeModal.classList.remove("hidden");
  resumeModal.setAttribute("aria-hidden", "false");
  renderBuilder();
}

function openTemplateModal() {
  if (!templateModal) {
    return;
  }

  templateModal.classList.remove("hidden");
  templateModal.setAttribute("aria-hidden", "false");
  loadTemplatePreviews();
}

function closeTemplateModal() {
  if (!templateModal) {
    return;
  }

  templateModal.classList.add("hidden");
  templateModal.setAttribute("aria-hidden", "true");
}

function isStepAccessible(stepIndex) {
  if (stepIndex === 0) {
    return true;
  }

  return appState.activeResume.completedSteps.slice(0, stepIndex).every(Boolean);
}

function renderRecentResumes() {
  if (!resumeList) {
    return;
  }

  resumeList.innerHTML = "";
  const combined = [...appState.resumes, ...sampleRecentResumes].slice(0, 6);

  combined.forEach((resume) => {
    const item = document.createElement("article");
    item.className = "resume-item";
    const actionMarkup = !resume.sample
      ? `<button class="resume-edit-button" type="button" data-resume-id="${resume.id}">Edit Resume</button>`
      : `<span class="resume-tag">${resume.status}</span>`;

    item.innerHTML = `
      <div>
        <h3>${resume.title}</h3>
        <p>${resume.updatedAt}</p>
      </div>
      <div class="resume-item-actions">
        <span class="resume-tag">${resume.status}</span>
        ${!resume.sample ? actionMarkup : ""}
      </div>
    `;

    const editButton = item.querySelector("[data-resume-id]");
    if (editButton) {
      editButton.addEventListener("click", () => {
        openResumeRoute(resume.id, true, resume.templateId || null);
      });
    }

    resumeList.appendChild(item);
  });
}

function renderStepper() {
  stepper.innerHTML = "";

  steps.forEach((step, index) => {
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "step-badge";

    if (index === appState.activeStep) {
      badge.classList.add("active");
    }

    if (appState.activeResume.completedSteps[index]) {
      badge.classList.add("complete");
    }

    if (!isStepAccessible(index)) {
      badge.classList.add("locked");
      badge.disabled = true;
    } else {
      badge.addEventListener("click", () => {
        appState.activeStep = index;
        renderBuilder();
      });
    }

    badge.innerHTML = `<strong>Step ${index + 1}</strong><span>${step.title}</span>`;
    stepper.appendChild(badge);
  });
}

function renderPersonalStep() {
  const { personal } = appState.activeResume;
  return `
    <section class="step-panel">
      <h3>Step 1: Personal details</h3>
      <p>Complete the contact section first. The next step stays locked until every required field here is filled.</p>
      <div class="form-grid">
        <div class="field-group">
          <label for="first-name">First Name</label>
          <input id="first-name" data-field="firstName" value="${personal.firstName}" />
        </div>
        <div class="field-group">
          <label for="last-name">Last Name</label>
          <input id="last-name" data-field="lastName" value="${personal.lastName}" />
        </div>
        <div class="field-group">
          <label for="email">Email Address</label>
          <input id="email" type="email" data-field="email" value="${personal.email}" />
        </div>
        <div class="field-group">
          <label for="phone">Phone Number</label>
          <input id="phone" data-field="phone" value="${personal.phone}" />
        </div>
        <div class="field-group full-width">
          <label for="address">Address</label>
          <input id="address" data-field="address" value="${personal.address}" />
        </div>
        <div class="field-group full-width">
          <label for="city-country">City, Country</label>
          <input id="city-country" data-field="cityCountry" value="${personal.cityCountry}" />
        </div>
        <div class="field-group full-width">
          <label>Links</label>
          ${personal.links
            .map(
              (link, index) => `
                <div class="field-group full-width">
                  <label for="link-${index}">Link ${index + 1}</label>
                  <input id="link-${index}" data-collection="links" data-index="${index}" value="${link}" placeholder="Portfolio, LinkedIn, GitHub, or website" />
                </div>
              `
            )
            .join("")}
          <div class="collection-toolbar">
            <button class="inline-add-button" type="button" id="add-link-button">+ Add Link</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderExperienceStep() {
  return `
    <section class="step-panel">
      <h3>Step 2: Experience</h3>
      <p>Add one or more experience entries. Each section needs all fields before the education step unlocks.</p>
      <div class="collection-stack">
        ${appState.activeResume.experience
          .map(
            (entry, index) => `
              <article class="collection-card">
                <div class="collection-card-header">
                  <h4>Experience ${index + 1}</h4>
                  ${appState.activeResume.experience.length > 1 ? `<button class="remove-button" type="button" data-remove="experience" data-index="${index}">Remove</button>` : ""}
                </div>
                <div class="form-grid">
                  <div class="field-group"><label>Title</label><input data-list="experience" data-index="${index}" data-field="title" value="${entry.title}" /></div>
                  <div class="field-group"><label>Subtitle</label><input data-list="experience" data-index="${index}" data-field="subtitle" value="${entry.subtitle}" /></div>
                  <div class="field-group"><label>Date Started</label><input type="date" data-list="experience" data-index="${index}" data-field="dateStarted" value="${entry.dateStarted}" /></div>
                  <div class="field-group"><label>Date Ended</label><input type="date" data-list="experience" data-index="${index}" data-field="dateEnded" value="${entry.dateEnded}" /></div>
                  <div class="field-group full-width"><label>Description</label><textarea data-list="experience" data-index="${index}" data-field="description">${entry.description}</textarea></div>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="collection-toolbar">
        <button class="inline-add-button" type="button" id="add-experience-button">+ Add Experience</button>
      </div>
    </section>
  `;
}

function renderEducationStep() {
  return `
    <section class="step-panel">
      <h3>Step 3: Education</h3>
      <p>Add as many education entries as you need. Each education section must be complete before skills unlock.</p>
      <div class="collection-stack">
        ${appState.activeResume.education
          .map(
            (entry, index) => `
              <article class="collection-card">
                <div class="collection-card-header">
                  <h4>Education ${index + 1}</h4>
                  ${appState.activeResume.education.length > 1 ? `<button class="remove-button" type="button" data-remove="education" data-index="${index}">Remove</button>` : ""}
                </div>
                <div class="form-grid">
                  <div class="field-group"><label>Title</label><input data-list="education" data-index="${index}" data-field="title" value="${entry.title}" /></div>
                  <div class="field-group"><label>Degree Type</label><select data-list="education" data-index="${index}" data-field="degreeType">${["Masters", "Bachelors", "Diploma", "Associate"].map((degree) => `<option value="${degree}" ${entry.degreeType === degree ? "selected" : ""}>${degree}</option>`).join("")}</select></div>
                  <div class="field-group"><label>Start Date</label><input type="date" data-list="education" data-index="${index}" data-field="startDate" value="${entry.startDate}" /></div>
                  <div class="field-group"><label>End Date</label><input type="date" data-list="education" data-index="${index}" data-field="endDate" value="${entry.endDate}" /></div>
                  <div class="field-group full-width"><label>Address</label><input data-list="education" data-index="${index}" data-field="address" value="${entry.address}" /></div>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="collection-toolbar">
        <button class="inline-add-button" type="button" id="add-education-button">+ Add Education</button>
      </div>
    </section>
  `;
}

function renderSkillsStep() {
  return `
    <section class="step-panel">
      <h3>Step 4: Highlight skills</h3>
      <p>Add up to 10 skills. At least one skill is required to complete the resume object.</p>
      <div class="form-grid">
        <div class="field-group full-width">
          <label for="skill-entry">Skill Entry</label>
          <input id="skill-entry" placeholder="Type a skill and click the button below" />
        </div>
      </div>
      <div class="collection-toolbar">
        <button class="inline-add-button" type="button" id="add-skill-button">+ Add Skill</button>
      </div>
      <div class="skill-grid">
        ${appState.activeResume.skills
          .map((skill, index) => `<span class="skill-pill">${skill}<button type="button" data-remove-skill="${index}" aria-label="Remove ${skill}">X</button></span>`)
          .join("")}
      </div>
    </section>
  `;
}

function renderAboutStep() {
  return `
    <section class="step-panel">
      <h3>Step 5: About yourself</h3>
      <p>Write a professional summary yourself, or click AI to generate one from the details you already entered.</p>
      <div class="form-grid">
        <div class="field-group full-width">
          <label for="about-summary">Professional Summary</label>
          <textarea id="about-summary" data-field="introduction">${appState.activeResume.personal.introduction || ""}</textarea>
        </div>
      </div>
      <div class="collection-toolbar">
        <button class="inline-add-button" type="button" id="generate-summary-button">AI</button>
      </div>
    </section>
  `;
}

function renderStepContent() {
  if (appState.activeStep === 0) return renderPersonalStep();
  if (appState.activeStep === 1) return renderExperienceStep();
  if (appState.activeStep === 2) return renderEducationStep();
  if (appState.activeStep === 3) return renderSkillsStep();
  return renderAboutStep();
}

function validatePersonal() {
  const { personal } = appState.activeResume;
  return personal.firstName.trim() && personal.lastName.trim() && personal.email.trim() && personal.address.trim() && personal.cityCountry.trim() && personal.phone.trim() && personal.links.every((link) => link.trim());
}

function validateExperience() {
  return appState.activeResume.experience.every((item) => item.title.trim() && item.subtitle.trim() && item.description.trim() && item.dateStarted && item.dateEnded);
}

function validateEducation() {
  return appState.activeResume.education.every((item) => item.title.trim() && item.degreeType && item.startDate && item.endDate && item.address.trim());
}

function validateSkills() {
  return appState.activeResume.skills.length > 0 && appState.activeResume.skills.length <= 10;
}

function validateAbout() {
  return appState.activeResume.personal.introduction.trim();
}

function validateStep(stepIndex) {
  if (stepIndex === 0) return validatePersonal();
  if (stepIndex === 1) return validateExperience();
  if (stepIndex === 2) return validateEducation();
  if (stepIndex === 3) return validateSkills();
  return validateAbout();
}

function bindBuilderEvents() {
  stepContent.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      appState.activeResume.personal[event.target.dataset.field] = event.target.value;
      updateResumeMeta(appState.activeResume);
    });
  });

  stepContent.querySelectorAll("[data-collection='links']").forEach((input) => {
    input.addEventListener("input", (event) => {
      appState.activeResume.personal.links[Number(event.target.dataset.index)] = event.target.value;
      updateResumeMeta(appState.activeResume);
    });
  });

  stepContent.querySelectorAll("[data-list]").forEach((input) => {
    const eventName = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, (event) => {
      const listName = event.target.dataset.list;
      const index = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      appState.activeResume[listName][index][field] = event.target.value;
      updateResumeMeta(appState.activeResume);
    });
  });

  const addLinkButton = document.getElementById("add-link-button");
  if (addLinkButton) {
    addLinkButton.addEventListener("click", () => {
      appState.activeResume.personal.links.push("");
      renderBuilder();
    });
  }

  const addExperienceButton = document.getElementById("add-experience-button");
  if (addExperienceButton) {
    addExperienceButton.addEventListener("click", () => {
      appState.activeResume.experience.push({ title: "", subtitle: "", description: "", dateStarted: "", dateEnded: "" });
      renderBuilder();
    });
  }

  const addEducationButton = document.getElementById("add-education-button");
  if (addEducationButton) {
    addEducationButton.addEventListener("click", () => {
      appState.activeResume.education.push({ title: "", degreeType: "Bachelors", startDate: "", endDate: "", address: "" });
      renderBuilder();
    });
  }

  stepContent.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      appState.activeResume[event.target.dataset.remove].splice(Number(event.target.dataset.index), 1);
      renderBuilder();
    });
  });

  const addSkillButton = document.getElementById("add-skill-button");
  if (addSkillButton) {
    addSkillButton.addEventListener("click", () => {
      const input = document.getElementById("skill-entry");
      const skill = input.value.trim();
      if (!skill || appState.activeResume.skills.length >= 10) {
        return;
      }

      appState.activeResume.skills.push(skill);
      input.value = "";
      renderBuilder();
    });
  }

  stepContent.querySelectorAll("[data-remove-skill]").forEach((button) => {
    button.addEventListener("click", (event) => {
      appState.activeResume.skills.splice(Number(event.target.dataset.removeSkill), 1);
      renderBuilder();
    });
  });

  const generateSummaryButton = document.getElementById("generate-summary-button");
  if (generateSummaryButton) {
    generateSummaryButton.addEventListener("click", async () => {
      generateSummaryButton.disabled = true;
      generateSummaryButton.textContent = "Generating...";

      try {
        appState.activeResume.personal.introduction = await requestSummaryFromLLM(appState.activeResume);
      } catch (_error) {
        appState.activeResume.personal.introduction = generateSummaryFromResume(appState.activeResume);
      } finally {
        renderBuilder();
      }
    });
  }
}

function renderBuilder() {
  resumeIdCopy.textContent = `Resume ID: ${appState.activeResume.id}`;
  renderStepper();
  stepContent.innerHTML = renderStepContent();
  bindBuilderEvents();
  backButton.disabled = appState.activeStep === 0;
  nextButton.textContent = appState.activeStep === 4 ? "Finish Resume" : "Save and Continue";
}

function renderTemplate(template, resume) {
  const data = {
    fullName: `${resume.personal.firstName} ${resume.personal.lastName}`.trim(),
    email: resume.personal.email || "",
    phone: resume.personal.phone || "",
    address: resume.personal.address || "",
    cityCountry: resume.personal.cityCountry || "",
    summary: resume.personal.introduction || "No profile summary added yet.",
    links: resume.personal.links.filter(Boolean).map((link) => `<span class="template-link">${link}</span>`).join(""),
    experienceItems: resume.experience
      .map(
        (entry) => `
          <article class="template-entry">
            <div class="template-entry-top">
              <div>
                <h3>${entry.title}</h3>
                <small>${entry.subtitle}</small>
              </div>
              <small>${formatDateLabel(entry.dateStarted)} - ${formatDateLabel(entry.dateEnded)}</small>
            </div>
            <p>${entry.description}</p>
          </article>
        `
      )
      .join(""),
    educationItems: resume.education
      .map(
        (entry) => `
          <article class="template-entry">
            <div class="template-entry-top">
              <div>
                <h3>${entry.title}</h3>
                <small>${entry.degreeType}</small>
              </div>
              <small>${formatDateLabel(entry.startDate)} - ${formatDateLabel(entry.endDate)}</small>
            </div>
            <p>${entry.address}</p>
          </article>
        `
      )
      .join(""),
    skillItems: resume.skills.map((skill) => `<span class="template-skill">${skill}</span>`).join(""),
  };

  const html = Object.entries(data).reduce((markup, [key, value]) => markup.replaceAll(`{{${key}}}`, value), template.html_markup);
  return `<style>${template.css_styles}</style>${html}`;
}

function renderResumePreview(resume) {
  const template = resume.templateId ? appState.templateMap[resume.templateId] : null;
  if (template) {
    resumePreview.innerHTML = renderTemplate(template, resume);
    return;
  }

  resumePreview.innerHTML = `
    <div class="resume-sheet-header">
      <h1>${resume.personal.firstName} ${resume.personal.lastName}</h1>
      <div class="resume-contact">
        <span>${resume.personal.email}</span>
        <span>${resume.personal.phone}</span>
        <span>${resume.personal.address}</span>
        <span>${resume.personal.cityCountry}</span>
      </div>
      <div class="resume-links">${resume.personal.links.filter(Boolean).map((link) => `<span>${link}</span>`).join("")}</div>
    </div>
    <section class="resume-section">
      <h2>Profile</h2>
      <article class="resume-entry">
        <p>${resume.personal.introduction || "No profile summary added yet."}</p>
      </article>
    </section>
    <section class="resume-section">
      <h2>Experience</h2>
      ${resume.experience
        .map(
          (entry) => `
            <article class="resume-entry">
              <div class="resume-entry-top">
                <div>
                  <h3>${entry.title}</h3>
                  <small>${entry.subtitle}</small>
                </div>
                <small>${formatDateLabel(entry.dateStarted)} - ${formatDateLabel(entry.dateEnded)}</small>
              </div>
              <p>${entry.description}</p>
            </article>
          `
        )
        .join("")}
    </section>
    <section class="resume-section">
      <h2>Education</h2>
      ${resume.education
        .map(
          (entry) => `
            <article class="resume-entry">
              <div class="resume-entry-top">
                <div>
                  <h4>${entry.title}</h4>
                  <small>${entry.degreeType}</small>
                </div>
                <small>${formatDateLabel(entry.startDate)} - ${formatDateLabel(entry.endDate)}</small>
              </div>
              <p>${entry.address}</p>
            </article>
          `
        )
        .join("")}
    </section>
    <section class="resume-section">
      <h2>Skills</h2>
      <div class="resume-skill-list">${resume.skills.map((skill) => `<span>${skill}</span>`).join("")}</div>
    </section>
  `;
}

function renderResumeEditor(resume) {
  resumeEditor.innerHTML = `
    <div class="editor-scroll">
      <section class="collection-card">
        <h3 class="editor-section-title">About Yourself</h3>
        <div class="form-grid">
          <div class="field-group full-width">
            <label>Professional Summary</label>
            <textarea data-editor-section="personal" data-field="introduction">${resume.personal.introduction || ""}</textarea>
          </div>
        </div>
        <div class="collection-toolbar">
          <button class="inline-add-button" type="button" id="editor-generate-summary">AI</button>
        </div>
      </section>
      <section class="collection-card">
        <h3 class="editor-section-title">Personal Details</h3>
        <div class="form-grid">
          <div class="field-group"><label>First Name</label><input data-editor-section="personal" data-field="firstName" value="${resume.personal.firstName}" /></div>
          <div class="field-group"><label>Last Name</label><input data-editor-section="personal" data-field="lastName" value="${resume.personal.lastName}" /></div>
          <div class="field-group"><label>Email Address</label><input data-editor-section="personal" data-field="email" value="${resume.personal.email}" /></div>
          <div class="field-group"><label>Phone Number</label><input data-editor-section="personal" data-field="phone" value="${resume.personal.phone}" /></div>
          <div class="field-group full-width"><label>Address</label><input data-editor-section="personal" data-field="address" value="${resume.personal.address}" /></div>
          <div class="field-group full-width"><label>City, Country</label><input data-editor-section="personal" data-field="cityCountry" value="${resume.personal.cityCountry}" /></div>
        </div>
      </section>
      <section class="collection-card">
        <h3 class="editor-section-title">Links</h3>
        <div class="collection-stack">
          ${resume.personal.links.map((link, index) => `<div class="field-group"><label>Link ${index + 1}</label><input data-editor-links="${index}" value="${link}" /></div>`).join("")}
        </div>
        <div class="collection-toolbar"><button class="inline-add-button" type="button" id="editor-add-link">+ Add Link</button></div>
      </section>
      <section class="collection-card">
        <h3 class="editor-section-title">Experience</h3>
        <div class="collection-stack">
          ${resume.experience
            .map(
              (entry, index) => `
                <article class="collection-card">
                  <div class="collection-card-header">
                    <h4>Experience ${index + 1}</h4>
                    ${resume.experience.length > 1 ? `<button class="remove-button" type="button" data-editor-remove="experience" data-index="${index}">Remove</button>` : ""}
                  </div>
                  <div class="form-grid">
                    <div class="field-group"><label>Title</label><input data-editor-list="experience" data-index="${index}" data-field="title" value="${entry.title}" /></div>
                    <div class="field-group"><label>Subtitle</label><input data-editor-list="experience" data-index="${index}" data-field="subtitle" value="${entry.subtitle}" /></div>
                    <div class="field-group"><label>Date Started</label><input type="date" data-editor-list="experience" data-index="${index}" data-field="dateStarted" value="${entry.dateStarted}" /></div>
                    <div class="field-group"><label>Date Ended</label><input type="date" data-editor-list="experience" data-index="${index}" data-field="dateEnded" value="${entry.dateEnded}" /></div>
                    <div class="field-group full-width"><label>Description</label><textarea data-editor-list="experience" data-index="${index}" data-field="description">${entry.description}</textarea></div>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
        <div class="collection-toolbar"><button class="inline-add-button" type="button" id="editor-add-experience">+ Add Experience</button></div>
      </section>
      <section class="collection-card">
        <h3 class="editor-section-title">Education</h3>
        <div class="collection-stack">
          ${resume.education
            .map(
              (entry, index) => `
                <article class="collection-card">
                  <div class="collection-card-header">
                    <h4>Education ${index + 1}</h4>
                    ${resume.education.length > 1 ? `<button class="remove-button" type="button" data-editor-remove="education" data-index="${index}">Remove</button>` : ""}
                  </div>
                  <div class="form-grid">
                    <div class="field-group"><label>Title</label><input data-editor-list="education" data-index="${index}" data-field="title" value="${entry.title}" /></div>
                    <div class="field-group"><label>Degree Type</label><select data-editor-list="education" data-index="${index}" data-field="degreeType">${["Masters", "Bachelors", "Diploma", "Associate"].map((degree) => `<option value="${degree}" ${entry.degreeType === degree ? "selected" : ""}>${degree}</option>`).join("")}</select></div>
                    <div class="field-group"><label>Start Date</label><input type="date" data-editor-list="education" data-index="${index}" data-field="startDate" value="${entry.startDate}" /></div>
                    <div class="field-group"><label>End Date</label><input type="date" data-editor-list="education" data-index="${index}" data-field="endDate" value="${entry.endDate}" /></div>
                    <div class="field-group full-width"><label>Address</label><input data-editor-list="education" data-index="${index}" data-field="address" value="${entry.address}" /></div>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
        <div class="collection-toolbar"><button class="inline-add-button" type="button" id="editor-add-education">+ Add Education</button></div>
      </section>
      <section class="collection-card">
        <h3 class="editor-section-title">Skills</h3>
        <div class="form-grid"><div class="field-group full-width"><label>Add Skill</label><input id="editor-skill-entry" placeholder="Add up to 10 skills" /></div></div>
        <div class="collection-toolbar"><button class="inline-add-button" type="button" id="editor-add-skill">+ Add Skill</button></div>
        <div class="skill-grid">${resume.skills.map((skill, index) => `<span class="skill-pill">${skill}<button type="button" data-editor-remove-skill="${index}">X</button></span>`).join("")}</div>
      </section>
    </div>
  `;

  bindResumeEditorEvents(resume.id);
}

function renderResumeDetail() {
  const resume = getResumeById(appState.routeResumeId);
  if (!resume) {
    if (appState.routeResumeId) {
      fetchResumeById(appState.routeResumeId)
        .then(() => {
          renderResumeDetail();
        })
        .catch(() => {
          openDashboard();
        });
      return;
    }

    openDashboard();
    return;
  }

  const templateId = appState.routeTemplateId || resume.templateId;
  if (templateId && !appState.templateMap[templateId]) {
    loadTemplateById(templateId)
      .then(() => {
        renderResumeDetail();
      })
      .catch(() => {
        renderResumePreview(resume);
        renderResumeEditor(resume);
      });
    return;
  }

  resumePageId.textContent = resume.id;
  renderResumePreview(resume);
  renderResumeEditor(resume);
}

async function downloadResumePdf() {
  const resume = getResumeById(appState.routeResumeId);
  if (!resume || !resumePreview) {
    return;
  }

  const html2canvasRef = window.html2canvas;
  const jsPdfRef = window.jspdf && window.jspdf.jsPDF;

  if (!html2canvasRef || !jsPdfRef) {
    if (downloadStatus) {
      downloadStatus.textContent = "PDF export library did not load. Refresh the page and try again.";
    }
    return;
  }

  if (downloadStatus) {
    downloadStatus.textContent = "Generating PDF...";
  }

  if (downloadPdfButton) {
    downloadPdfButton.disabled = true;
  }

  try {
    const canvas = await html2canvasRef(resumePreview, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fffefc",
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPdfRef("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    let remainingHeight = contentHeight;
    let position = margin;

    pdf.addImage(imageData, "PNG", margin, position, contentWidth, contentHeight);
    remainingHeight -= pageHeight - margin * 2;

    while (remainingHeight > 0) {
      position = remainingHeight - contentHeight + margin;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", margin, position, contentWidth, contentHeight);
      remainingHeight -= pageHeight - margin * 2;
    }

    const fileName = `${resume.title.replace(/\s+/g, "-").toLowerCase() || "resume"}.pdf`;
    pdf.save(fileName);

    if (downloadStatus) {
      downloadStatus.textContent = "PDF downloaded.";
    }
  } catch (error) {
    if (downloadStatus) {
      downloadStatus.textContent = "PDF export failed. Try again.";
    }
  } finally {
    if (downloadPdfButton) {
      downloadPdfButton.disabled = false;
    }
  }
}

function bindResumeEditorEvents(resumeId) {
  const resume = getResumeById(resumeId);
  if (!resume) {
    return;
  }

  resumeEditor.querySelectorAll("[data-editor-section]").forEach((input) => {
    input.addEventListener("input", (event) => {
      resume.personal[event.target.dataset.field] = event.target.value;
      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  });

  resumeEditor.querySelectorAll("[data-editor-links]").forEach((input) => {
    input.addEventListener("input", (event) => {
      resume.personal.links[Number(event.target.dataset.editorLinks)] = event.target.value;
      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  });

  resumeEditor.querySelectorAll("[data-editor-list]").forEach((input) => {
    const eventName = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, (event) => {
      const listName = event.target.dataset.editorList;
      const index = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      resume[listName][index][field] = event.target.value;
      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  });

  resumeEditor.querySelectorAll("[data-editor-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      resume[event.target.dataset.editorRemove].splice(Number(event.target.dataset.index), 1);
      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  });

  resumeEditor.querySelectorAll("[data-editor-remove-skill]").forEach((button) => {
    button.addEventListener("click", (event) => {
      resume.skills.splice(Number(event.target.dataset.editorRemoveSkill), 1);
      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  });

  const addLinkButton = document.getElementById("editor-add-link");
  if (addLinkButton) {
    addLinkButton.addEventListener("click", () => {
      resume.personal.links.push("");
      persistResume(resume);
      renderResumeDetail();
    });
  }

  const addExperienceButton = document.getElementById("editor-add-experience");
  if (addExperienceButton) {
    addExperienceButton.addEventListener("click", () => {
      resume.experience.push({ title: "", subtitle: "", description: "", dateStarted: "", dateEnded: "" });
      persistResume(resume);
      renderResumeDetail();
    });
  }

  const addEducationButton = document.getElementById("editor-add-education");
  if (addEducationButton) {
    addEducationButton.addEventListener("click", () => {
      resume.education.push({ title: "", degreeType: "Bachelors", startDate: "", endDate: "", address: "" });
      persistResume(resume);
      renderResumeDetail();
    });
  }

  const addSkillButton = document.getElementById("editor-add-skill");
  if (addSkillButton) {
    addSkillButton.addEventListener("click", () => {
      const input = document.getElementById("editor-skill-entry");
      const skill = input.value.trim();
      if (!skill || resume.skills.length >= 10) {
        return;
      }

      resume.skills.push(skill);
      input.value = "";
      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  }

  const generateSummaryButton = document.getElementById("editor-generate-summary");
  if (generateSummaryButton) {
    generateSummaryButton.addEventListener("click", async () => {
      generateSummaryButton.disabled = true;
      generateSummaryButton.textContent = "Generating...";

      try {
        resume.personal.introduction = await requestSummaryFromLLM(resume);
      } catch (_error) {
        resume.personal.introduction = generateSummaryFromResume(resume);
      }

      updateResumeMeta(resume);
      persistResume(resume);
      renderResumeDetail();
    });
  }
}

async function loadTemplatePreviews() {
  if (!templateGrid) {
    return;
  }

  templateGrid.innerHTML = "<p>Loading templates...</p>";

  try {
    const response = await fetch("/api/templates/previews", {
      credentials: "same-origin",
    });
    const templates = await response.json();

    if (!response.ok) {
      throw new Error(templates.message || "Failed to load templates.");
    }

    templateGrid.innerHTML = templates
      .map(
        (template) => `
          <article class="template-card">
            <img src="${template.preview_image_url}" alt="${template.name} preview" />
            <h3>${template.name}</h3>
            <button class="primary-action" type="button" data-template-id="${template.template_id}">
              Choose This Template
            </button>
          </article>
        `
      )
      .join("");

    templateGrid.querySelectorAll("[data-template-id]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const templateId = event.target.dataset.templateId;
        await selectTemplate(templateId);
      });
    });
  } catch (error) {
    templateGrid.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadTemplateById(templateId) {
  const response = await fetch(`/api/templates/${templateId}`, {
    credentials: "same-origin",
  });
  const template = await response.json();

  if (!response.ok) {
    throw new Error(template.message || "Failed to load template.");
  }

  appState.templateMap[templateId] = template;
  return template;
}

async function selectTemplate(templateId) {
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
    throw new Error(selectData.message || "Failed to select template.");
  }

  const template = await loadTemplateById(templateId);
  const newResume = createResumeObject();
  newResume.templateId = templateId;
  updateResumeMeta(newResume);
  appState.resumes.unshift(cloneResume(newResume));
  saveStoredResumes();
  renderRecentResumes();
  await persistResumeToServer(newResume);
  closeTemplateModal();
  openResumeRoute(newResume.id, true, template.template_id);
}

function resolveRoute() {
  const url = new URL(window.location.href);
  const resumeId = url.searchParams.get("resume");
  const templateId = url.searchParams.get("template");

  if (resumeId) {
    openResumeRoute(resumeId, false, templateId);
  } else {
    openDashboard(false);
  }
}

createResumeButton.addEventListener("click", openResumeBuilder);
closeModalButton.addEventListener("click", closeResumeBuilder);
modalBackdrop.addEventListener("click", closeResumeBuilder);
if (chooseTemplateButton) {
  chooseTemplateButton.addEventListener("click", openTemplateModal);
}
if (closeTemplateModalButton) {
  closeTemplateModalButton.addEventListener("click", closeTemplateModal);
}
if (templateModalBackdrop) {
  templateModalBackdrop.addEventListener("click", closeTemplateModal);
}
backToDashboardButton.addEventListener("click", () => openDashboard(true));

backButton.addEventListener("click", () => {
  if (appState.activeStep > 0) {
    appState.activeStep -= 1;
    renderBuilder();
  }
});

nextButton.addEventListener("click", () => {
  if (!validateStep(appState.activeStep)) {
    nextButton.textContent = "Complete Current Step First";
    window.setTimeout(() => {
      renderBuilder();
    }, 1000);
    return;
  }

  appState.activeResume.completedSteps[appState.activeStep] = true;
  updateResumeMeta(appState.activeResume);
  persistResume(appState.activeResume);
  persistResumeToServer(appState.activeResume).catch(() => {});

  if (appState.activeStep < 4) {
    appState.activeStep += 1;
    renderBuilder();
    return;
  }

  const completedResumeId = appState.activeResume.id;
  const completedTemplateId = appState.activeResume.templateId || null;
  closeResumeBuilder();
  openResumeRoute(completedResumeId, true, completedTemplateId);
});

if (downloadPdfButton) {
  downloadPdfButton.addEventListener("click", downloadResumePdf);
}

if (dashboardProfileTrigger) {
  dashboardProfileTrigger.addEventListener("click", () => {
    setProfileMenuOpen(!appState.profileMenuOpen);
  });
}

if (dashboardProfileMenu) {
  dashboardProfileMenu.addEventListener("mouseenter", () => {
    setProfileMenuOpen(true);
  });

  dashboardProfileMenu.addEventListener("mouseleave", () => {
    appState.profileMenuCloseTimer = window.setTimeout(() => {
      setProfileMenuOpen(false);
    }, 140);
  });
}

if (accountSettingsButton) {
  accountSettingsButton.addEventListener("click", () => {
    window.location.href = "/account-settings";
    setProfileMenuOpen(false);
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.sessionStorage.removeItem("resume-maker-session");
      window.location.href = "/login";
    }
  });
}

document.addEventListener("click", (event) => {
  if (!dashboardProfileMenu || dashboardProfileMenu.contains(event.target)) {
    return;
  }

  setProfileMenuOpen(false);
});

window.addEventListener("popstate", resolveRoute);

renderRecentResumes();
loadSessionUser();
resolveRoute();
