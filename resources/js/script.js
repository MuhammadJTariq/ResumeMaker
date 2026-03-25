const STORAGE_KEY = "resume-maker-app-state";

const SAMPLE_RECENT_RESUMES = [
  { title: "Product Designer Resume", updatedAt: "Edited 2 hours ago", status: "Ready to export", sample: true },
  { title: "Marketing Manager Resume", updatedAt: "Edited yesterday", status: "Needs review", sample: true },
  { title: "Software Engineer Resume", updatedAt: "Edited 3 days ago", status: "Tailored draft", sample: true },
];

const STEPS = [
  { key: "personal", title: "Personal Details" },
  { key: "experience", title: "Experience" },
  { key: "education", title: "Education" },
  { key: "skills", title: "Skills" },
  { key: "about", title: "About Yourself" },
];

class ResumeFactory {
  static createId() {
    return `RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  static createEmpty() {
    return {
      id: ResumeFactory.createId(),
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

  static clone(resume) {
    return JSON.parse(JSON.stringify(resume));
  }

  static updateMeta(resume) {
    const fullName = `${resume.personal.firstName} ${resume.personal.lastName}`.trim();
    const completedCount = resume.completedSteps.filter(Boolean).length;
    resume.title = fullName ? `${fullName} Resume` : "Untitled Resume";
    resume.status = completedCount === STEPS.length ? "Completed" : `Step ${Math.min(completedCount + 1, STEPS.length)} of ${STEPS.length}`;
    resume.updatedAt = "Updated just now";
  }

  static generateSummary(resume) {
    const fullName = `${resume.personal.firstName} ${resume.personal.lastName}`.trim() || "This candidate";
    const experience = resume.experience.find((item) => item.title.trim() || item.subtitle.trim());
    const education = resume.education.find((item) => item.title.trim());
    const skills = resume.skills.slice(0, 4).join(", ");
    const roleText = experience?.title?.trim() || "professional";
    const subtitleText = experience?.subtitle?.trim() ? ` with experience in ${experience.subtitle.trim()}` : "";
    const locationText = resume.personal.cityCountry?.trim() ? ` based in ${resume.personal.cityCountry.trim()}` : "";
    const educationText = education?.title?.trim()
      ? ` Holds ${String(education.degreeType || "").toLowerCase()} education in ${education.title.trim()}.`
      : "";
    const skillsText = skills ? ` Key strengths include ${skills}.` : "";

    return `${fullName} is a ${roleText}${subtitleText}${locationText}. Brings practical experience and a strong foundation for high-impact work.${educationText}${skillsText}`.trim();

  }

  static formatDateLabel(value) {
    if (!value) {
      return "Present";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  }
}

class ResumeStore {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.resumes = this.loadStoredResumes();
    this.activeResume = null;
    this.activeStep = 0;
    this.routeResumeId = null;
    this.routeTemplateId = null;
    this.templateMap = {};
  }

  loadStoredResumes() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.resumes) ? parsed.resumes : [];
    } catch {
      return [];
    }
  }

  saveStoredResumes() {
    window.localStorage.setItem(this.storageKey, JSON.stringify({ resumes: this.resumes }));
  }

  getResumeById(resumeId) {
    return this.resumes.find((resume) => resume.id === resumeId) || null;
  }

  upsertResume(resume) {
    const nextResume = ResumeFactory.clone(resume);
    const index = this.resumes.findIndex((item) => item.id === nextResume.id);

    if (index === -1) {
      this.resumes.unshift(nextResume);
    } else {
      this.resumes[index] = nextResume;
    }

    this.saveStoredResumes();
  }

  setTemplate(template) {
    this.templateMap[template.template_id] = template;
  }

  getTemplate(templateId) {
    return this.templateMap[templateId] || null;
  }
}

class ApiClient {
  async request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  async getSessionUser() {
    return this.request("/api/session");
  }

  async logout() {
    return this.request("/api/logout", { method: "POST" });
  }

  async fetchResumeById(resumeId) {
    return this.request(`/api/resumes/${resumeId}`);
  }

  async fetchResumes() {
    return this.request("/api/resumes");
  }

  async persistResume(resume) {
    return this.request("/api/resumes", {
      method: "POST",
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
  }

  async getTemplatePreviews() {
    return this.request("/api/templates/previews");
  }

  async getTemplateById(templateId) {
    return this.request(`/api/templates/${templateId}`);
  }

  async selectTemplate(templateId) {
    return this.request("/api/templates/select", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId }),
    });
  }
}

class ProfileMenuController {
  constructor(app) {
    this.app = app;
    this.menu = document.getElementById("dashboard-profile-menu");
    this.trigger = document.getElementById("dashboard-profile-trigger");
    this.dropdown = document.getElementById("dashboard-profile-dropdown");
    this.accountSettingsButton = document.getElementById("account-settings-button");
    this.logoutButton = document.getElementById("logout-button");
    this.profileName = document.getElementById("dashboard-profile-name");
    this.profilePlan = document.getElementById("dashboard-profile-plan");
    this.isOpen = false;
    this.closeTimer = null;
  }

  initialize() {
    if (!this.trigger || !this.menu || !this.dropdown) {
      return;
    }

    this.trigger.addEventListener("click", () => this.setOpen(!this.isOpen));
    this.menu.addEventListener("mouseenter", () => this.setOpen(true));
    this.menu.addEventListener("mouseleave", () => {
      this.closeTimer = window.setTimeout(() => this.setOpen(false), 140);
    });

    if (this.accountSettingsButton) {
      this.accountSettingsButton.addEventListener("click", () => {
        window.location.href = "/account-settings";
        this.setOpen(false);
      });
    }

    if (this.logoutButton) {
      this.logoutButton.addEventListener("click", async () => {
        try {
          await this.app.api.logout();
        } finally {
          window.sessionStorage.removeItem("resume-maker-session");
          window.location.href = "/login";
        }
      });
    }

    document.addEventListener("click", (event) => {
      if (this.menu.contains(event.target)) {
        return;
      }

      this.setOpen(false);
    });
  }

  setOpen(isOpen) {
    if (!this.dropdown || !this.trigger) {
      return;
    }

    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    this.isOpen = isOpen;
    this.dropdown.classList.toggle("hidden", !isOpen);
    this.trigger.setAttribute("aria-expanded", String(isOpen));
  }

  async loadUser() {
    try {
      const data = await this.app.api.getSessionUser();
      const fullName = `${data.user.firstName} ${data.user.lastName}`.trim();

      if (this.profileName) {
        this.profileName.textContent = fullName || "User";
      }
      if (this.profilePlan) {
        this.profilePlan.textContent = data.user.email || "Account";
      }
      if (fullName) {
        document.title = `${fullName} | ResumeMaker`;
      }
    } catch (_error) {
      // Protected route middleware handles redirect.
    }
  }
}

class DashboardController {
  constructor(app) {
    this.app = app;
    this.dashboardPage = document.getElementById("dashboard-page");
    this.resumePage = document.getElementById("resume-page");
    this.resumeList = document.getElementById("resume-list");
    this.createResumeButton = document.getElementById("create-resume-button");
    this.backToDashboardButton = document.getElementById("back-to-dashboard");
  }

  initialize() {
    if (this.createResumeButton) {
      this.createResumeButton.addEventListener("click", () => this.app.builder.open());
    }

    if (this.backToDashboardButton) {
      this.backToDashboardButton.addEventListener("click", () => this.app.openDashboard(true));
    }
  }

  showDashboard(pushHistory = true) {
    if (this.dashboardPage) {
      this.dashboardPage.classList.remove("hidden");
    }
    if (this.resumePage) {
      this.resumePage.classList.add("hidden");
    }

    this.app.store.routeResumeId = null;
    this.app.store.routeTemplateId = null;

    if (pushHistory) {
      window.history.pushState({}, "", window.location.pathname);
    }
  }

  showResumePage() {
    if (this.dashboardPage) {
      this.dashboardPage.classList.add("hidden");
    }
    if (this.resumePage) {
      this.resumePage.classList.remove("hidden");
    }
  }

  renderRecentResumes() {
    if (!this.resumeList) {
      return;
    }

    this.resumeList.innerHTML = "";
    const combined = [...this.app.store.resumes, ...SAMPLE_RECENT_RESUMES].slice(0, 6);

    combined.forEach((resume) => {
      const item = document.createElement("article");
      item.className = "resume-item";
      item.innerHTML = `
        <div>
          <h3>${resume.title}</h3>
          <p>${resume.updatedAt}</p>
        </div>
        <div class="resume-item-actions">
          <span class="resume-tag">${resume.status}</span>
          ${resume.sample ? "" : `<button class="resume-edit-button" type="button" data-resume-id="${resume.id}">Edit Resume</button>`}
        </div>
      `;

      const editButton = item.querySelector("[data-resume-id]");
      if (editButton) {
        editButton.addEventListener("click", () => {
          this.app.openResumeRoute(resume.id, true, resume.templateId || null);
        });
      }

      this.resumeList.appendChild(item);
    });
  }
}

class ResumeBuilderController {
  constructor(app) {
    this.app = app;
    this.modal = document.getElementById("resume-modal");
    this.closeButton = document.getElementById("close-modal-button");
    this.backdrop = document.getElementById("modal-backdrop");
    this.stepper = document.getElementById("stepper");
    this.stepContent = document.getElementById("step-content");
    this.nextButton = document.getElementById("next-button");
    this.backButton = document.getElementById("back-button");
    this.resumeIdCopy = document.getElementById("resume-id-copy");
  }

  initialize() {
    if (this.closeButton) {
      this.closeButton.addEventListener("click", () => this.close());
    }

    if (this.backdrop) {
      this.backdrop.addEventListener("click", () => this.close());
    }

    if (this.backButton) {
      this.backButton.addEventListener("click", () => {
        if (this.app.store.activeStep > 0) {
          this.app.store.activeStep -= 1;
          this.render();
        }
      });
    }

    if (this.nextButton) {
      this.nextButton.addEventListener("click", () => this.handleNext());
    }
  }

  open() {
    this.app.store.activeResume = ResumeFactory.createEmpty();
    this.app.store.activeStep = 0;
    this.modal.classList.remove("hidden");
    this.modal.setAttribute("aria-hidden", "false");
    this.render();
  }

  close() {
    this.modal.classList.add("hidden");
    this.modal.setAttribute("aria-hidden", "true");
    this.app.store.activeResume = null;
    this.app.store.activeStep = 0;
  }

  isStepAccessible(stepIndex) {
    if (stepIndex === 0) {
      return true;
    }

    return this.app.store.activeResume.completedSteps.slice(0, stepIndex).every(Boolean);
  }

  validateStep(stepIndex) {
    const resume = this.app.store.activeResume;

    if (stepIndex === 0) {
      const { personal } = resume;
      return Boolean(
        personal.firstName.trim() &&
          personal.lastName.trim() &&
          personal.email.trim() &&
          personal.address.trim() &&
          personal.cityCountry.trim() &&
          personal.phone.trim() &&
          personal.links.every((link) => link.trim())
      );
    }

    if (stepIndex === 1) {
      return resume.experience.every((item) => item.title.trim() && item.subtitle.trim() && item.description.trim() && item.dateStarted && item.dateEnded);
    }

    if (stepIndex === 2) {
      return resume.education.every((item) => item.title.trim() && item.degreeType && item.startDate && item.endDate && item.address.trim());
    }

    if (stepIndex === 3) {
      return resume.skills.length > 0 && resume.skills.length <= 10;
    }

    return Boolean(resume.personal.introduction.trim());
  }

  render() {
    const resume = this.app.store.activeResume;
    if (!resume) {
      return;
    }

    this.resumeIdCopy.textContent = `Resume ID: ${resume.id}`;
    this.renderStepper();
    this.stepContent.innerHTML = this.renderCurrentStep();
    this.bindEvents();

    this.backButton.disabled = this.app.store.activeStep === 0;
    this.nextButton.textContent = this.app.store.activeStep === STEPS.length - 1 ? "Finish Resume" : "Save and Continue";
  }

  renderStepper() {
    this.stepper.innerHTML = "";

    STEPS.forEach((step, index) => {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "step-badge";
      badge.innerHTML = `<strong>Step ${index + 1}</strong><span>${step.title}</span>`;

      if (index === this.app.store.activeStep) {
        badge.classList.add("active");
      }

      if (this.app.store.activeResume.completedSteps[index]) {
        badge.classList.add("complete");
      }

      if (!this.isStepAccessible(index)) {
        badge.classList.add("locked");
        badge.disabled = true;
      } else {
        badge.addEventListener("click", () => {
          this.app.store.activeStep = index;
          this.render();
        });
      }

      this.stepper.appendChild(badge);
    });
  }

  renderCurrentStep() {
    if (this.app.store.activeStep === 0) {
      return this.renderPersonalStep();
    }
    if (this.app.store.activeStep === 1) {
      return this.renderExperienceStep();
    }
    if (this.app.store.activeStep === 2) {
      return this.renderEducationStep();
    }
    if (this.app.store.activeStep === 3) {
      return this.renderSkillsStep();
    }
    return this.renderAboutStep();
  }

  renderPersonalStep() {
    const { personal } = this.app.store.activeResume;
    return `
      <section class="step-panel">
        <h3>Step 1: Personal details</h3>
        <p>Complete the contact section first. The next step stays locked until every required field here is filled.</p>
        <div class="form-grid">
          <div class="field-group"><label for="first-name">First Name</label><input id="first-name" data-field="firstName" value="${personal.firstName}" /></div>
          <div class="field-group"><label for="last-name">Last Name</label><input id="last-name" data-field="lastName" value="${personal.lastName}" /></div>
          <div class="field-group"><label for="email">Email Address</label><input id="email" type="email" data-field="email" value="${personal.email}" /></div>
          <div class="field-group"><label for="phone">Phone Number</label><input id="phone" data-field="phone" value="${personal.phone}" /></div>
          <div class="field-group full-width"><label for="address">Address</label><input id="address" data-field="address" value="${personal.address}" /></div>
          <div class="field-group full-width"><label for="city-country">City, Country</label><input id="city-country" data-field="cityCountry" value="${personal.cityCountry}" /></div>
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

  renderExperienceStep() {
    const resume = this.app.store.activeResume;
    return `
      <section class="step-panel">
        <h3>Step 2: Experience</h3>
        <p>Add one or more experience entries. Each section needs all fields before the education step unlocks.</p>
        <div class="collection-stack">
          ${resume.experience
            .map(
              (entry, index) => `
                <article class="collection-card">
                  <div class="collection-card-header">
                    <h4>Experience ${index + 1}</h4>
                    ${resume.experience.length > 1 ? `<button class="remove-button" type="button" data-remove="experience" data-index="${index}">Remove</button>` : ""}
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

  renderEducationStep() {
    const resume = this.app.store.activeResume;
    return `
      <section class="step-panel">
        <h3>Step 3: Education</h3>
        <p>Add as many education entries as you need. Each education section must be complete before skills unlock.</p>
        <div class="collection-stack">
          ${resume.education
            .map(
              (entry, index) => `
                <article class="collection-card">
                  <div class="collection-card-header">
                    <h4>Education ${index + 1}</h4>
                    ${resume.education.length > 1 ? `<button class="remove-button" type="button" data-remove="education" data-index="${index}">Remove</button>` : ""}
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

  renderSkillsStep() {
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
          ${this.app.store.activeResume.skills
            .map((skill, index) => `<span class="skill-pill">${skill}<button type="button" data-remove-skill="${index}" aria-label="Remove ${skill}">X</button></span>`)
            .join("")}
        </div>
      </section>
    `;
  }

  renderAboutStep() {
    return `
      <section class="step-panel">
        <h3>Step 5: About yourself</h3>
        <p>Write a professional summary yourself, or click AI to generate one from the details you already entered.</p>
        <div class="form-grid">
          <div class="field-group full-width">
            <label for="about-summary">Professional Summary</label>
            <textarea id="about-summary" data-field="introduction">${this.app.store.activeResume.personal.introduction || ""}</textarea>
          </div>
        </div>
        <div class="collection-toolbar">
          <button class="inline-add-button" type="button" id="generate-summary-button">AI</button>
        </div>
      </section>
    `;
  }

  bindEvents() {
    this.stepContent.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", (event) => {
        this.app.store.activeResume.personal[event.target.dataset.field] = event.target.value;
        ResumeFactory.updateMeta(this.app.store.activeResume);
      });
    });

    this.stepContent.querySelectorAll("[data-collection='links']").forEach((input) => {
      input.addEventListener("input", (event) => {
        this.app.store.activeResume.personal.links[Number(event.target.dataset.index)] = event.target.value;
        ResumeFactory.updateMeta(this.app.store.activeResume);
      });
    });

    this.stepContent.querySelectorAll("[data-list]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, (event) => {
        const listName = event.target.dataset.list;
        const index = Number(event.target.dataset.index);
        const field = event.target.dataset.field;
        this.app.store.activeResume[listName][index][field] = event.target.value;
        ResumeFactory.updateMeta(this.app.store.activeResume);
      });
    });

    this.bindCollectionButtons();
    this.bindSummaryButton();
  }

  bindCollectionButtons() {
    const addLinkButton = document.getElementById("add-link-button");
    if (addLinkButton) {
      addLinkButton.addEventListener("click", () => {
        this.app.store.activeResume.personal.links.push("");
        this.render();
      });
    }

    const addExperienceButton = document.getElementById("add-experience-button");
    if (addExperienceButton) {
      addExperienceButton.addEventListener("click", () => {
        this.app.store.activeResume.experience.push({ title: "", subtitle: "", description: "", dateStarted: "", dateEnded: "" });
        this.render();
      });
    }

    const addEducationButton = document.getElementById("add-education-button");
    if (addEducationButton) {
      addEducationButton.addEventListener("click", () => {
        this.app.store.activeResume.education.push({ title: "", degreeType: "Bachelors", startDate: "", endDate: "", address: "" });
        this.render();
      });
    }

    this.stepContent.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", (event) => {
        this.app.store.activeResume[event.target.dataset.remove].splice(Number(event.target.dataset.index), 1);
        this.render();
      });
    });

    const addSkillButton = document.getElementById("add-skill-button");
    if (addSkillButton) {
      addSkillButton.addEventListener("click", () => {
        const input = document.getElementById("skill-entry");
        const skill = input.value.trim();
        if (!skill || this.app.store.activeResume.skills.length >= 10) {
          return;
        }

        this.app.store.activeResume.skills.push(skill);
        input.value = "";
        this.render();
      });
    }

    this.stepContent.querySelectorAll("[data-remove-skill]").forEach((button) => {
      button.addEventListener("click", (event) => {
        this.app.store.activeResume.skills.splice(Number(event.target.dataset.removeSkill), 1);
        this.render();
      });
    });
  }

  bindSummaryButton() {
    const generateSummaryButton = document.getElementById("generate-summary-button");
    if (!generateSummaryButton) {
      return;
    }

    generateSummaryButton.addEventListener("click", async () => {
      generateSummaryButton.disabled = true;
      generateSummaryButton.textContent = "Generating...";

      try {
        this.app.store.activeResume.personal.introduction = await this.app.llm.generateResumeSummary(this.app.store.activeResume);
      } catch (_error) {
        this.app.store.activeResume.personal.introduction = ResumeFactory.generateSummary(this.app.store.activeResume);
      } finally {
        this.render();
      }
    });
  }

  async handleNext() {
    if (!this.validateStep(this.app.store.activeStep)) {
      this.nextButton.textContent = "Complete Current Step First";
      window.setTimeout(() => this.render(), 1000);
      return;
    }

    this.app.store.activeResume.completedSteps[this.app.store.activeStep] = true;
    ResumeFactory.updateMeta(this.app.store.activeResume);
    this.app.persistResume(this.app.store.activeResume);
    this.app.api.persistResume(this.app.store.activeResume).catch(() => {});

    if (this.app.store.activeStep < STEPS.length - 1) {
      this.app.store.activeStep += 1;
      this.render();
      return;
    }

    const completedResumeId = this.app.store.activeResume.id;
    const completedTemplateId = this.app.store.activeResume.templateId || null;
    this.close();
    this.app.openResumeRoute(completedResumeId, true, completedTemplateId);
  }
}

class TemplateModalController {
  constructor(app) {
    this.app = app;
    this.modal = document.getElementById("template-modal");
    this.backdrop = document.getElementById("template-modal-backdrop");
    this.closeButton = document.getElementById("close-template-modal-button");
    this.openButton = document.getElementById("choose-template-button");
    this.grid = document.getElementById("template-grid");
  }

  initialize() {
    if (this.openButton) {
      this.openButton.addEventListener("click", () => this.open());
    }

    if (this.closeButton) {
      this.closeButton.addEventListener("click", () => this.close());
    }

    if (this.backdrop) {
      this.backdrop.addEventListener("click", () => this.close());
    }
  }

  open() {
    if (!this.modal) {
      return;
    }

    this.modal.classList.remove("hidden");
    this.modal.setAttribute("aria-hidden", "false");
    this.loadPreviews();
  }

  close() {
    if (!this.modal) {
      return;
    }

    this.modal.classList.add("hidden");
    this.modal.setAttribute("aria-hidden", "true");
  }

  async loadPreviews() {
    if (!this.grid) {
      return;
    }

    this.grid.innerHTML = "<p>Loading templates...</p>";

    try {
      const templates = await this.app.api.getTemplatePreviews();
      this.grid.innerHTML = templates
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

      this.grid.querySelectorAll("[data-template-id]").forEach((button) => {
        button.addEventListener("click", async (event) => {
          const templateId = event.target.dataset.templateId;
          await this.selectTemplate(templateId);
        });
      });
    } catch (error) {
      this.grid.innerHTML = `<p>${error.message}</p>`;
    }
  }

  async loadTemplateById(templateId) {
    const template = await this.app.api.getTemplateById(templateId);
    this.app.store.setTemplate(template);
    return template;
  }

  async selectTemplate(templateId) {
    await this.app.api.selectTemplate(templateId);
    const template = await this.loadTemplateById(templateId);

    const newResume = ResumeFactory.createEmpty();
    newResume.templateId = templateId;
    ResumeFactory.updateMeta(newResume);

    this.app.persistResume(newResume);
    await this.app.api.persistResume(newResume);

    this.close();
    this.app.openResumeRoute(newResume.id, true, template.template_id);
  }
}

class ResumeDetailController {
  constructor(app) {
    this.app = app;
    this.resumePreview = document.getElementById("resume-preview");
    this.resumeEditor = document.getElementById("resume-editor");
    this.resumePageId = document.getElementById("resume-page-id");
    this.downloadPdfButton = document.getElementById("download-pdf-button");
    this.downloadStatus = document.getElementById("download-status");
  }

  initialize() {
    if (this.downloadPdfButton) {
      this.downloadPdfButton.addEventListener("click", () => this.downloadPdf());
    }
  }

  async renderDetail() {
    let resume = this.app.store.getResumeById(this.app.store.routeResumeId);

    if (!resume) {
      if (!this.app.store.routeResumeId) {
        this.app.openDashboard();
        return;
      }

      try {
        resume = await this.app.fetchResumeFromServer(this.app.store.routeResumeId);
      } catch (_error) {
        this.app.openDashboard();
        return;
      }
    }

    const templateId = this.app.store.routeTemplateId || resume.templateId;
    if (templateId && !this.app.store.getTemplate(templateId)) {
      try {
        await this.app.templates.loadTemplateById(templateId);
      } catch (_error) {
        // Fall back to default layout.
      }
    }

    this.resumePageId.textContent = resume.id;
    this.renderPreview(resume);
    this.renderEditor(resume);
  }

  renderTemplate(template, resume) {
    const replacements = {
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
                <small>${ResumeFactory.formatDateLabel(entry.dateStarted)} - ${ResumeFactory.formatDateLabel(entry.dateEnded)}</small>
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
                <small>${ResumeFactory.formatDateLabel(entry.startDate)} - ${ResumeFactory.formatDateLabel(entry.endDate)}</small>
              </div>
              <p>${entry.address}</p>
            </article>
          `
        )
        .join(""),
      skillItems: resume.skills.map((skill) => `<span class="template-skill">${skill}</span>`).join(""),
    };

    const html = Object.entries(replacements).reduce((markup, [key, value]) => markup.replaceAll(`{{${key}}}`, value), template.html_markup);
    return `<style>${template.css_styles}</style>${html}`;
  }

  renderPreview(resume) {
    const template = resume.templateId ? this.app.store.getTemplate(resume.templateId) : null;
    if (template) {
      this.resumePreview.innerHTML = this.renderTemplate(template, resume);
      return;
    }

    this.resumePreview.innerHTML = `
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
                  <small>${ResumeFactory.formatDateLabel(entry.dateStarted)} - ${ResumeFactory.formatDateLabel(entry.dateEnded)}</small>
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
                  <small>${ResumeFactory.formatDateLabel(entry.startDate)} - ${ResumeFactory.formatDateLabel(entry.endDate)}</small>
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

  renderEditor(resume) {
    this.resumeEditor.innerHTML = `
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

    this.bindEditorEvents(resume.id);
  }

  bindEditorEvents(resumeId) {
    const resume = this.app.store.getResumeById(resumeId);
    if (!resume) {
      return;
    }

    this.resumeEditor.querySelectorAll("[data-editor-section]").forEach((input) => {
      input.addEventListener("input", (event) => {
        resume.personal[event.target.dataset.field] = event.target.value;
        this.commit(resume);
      });
    });

    this.resumeEditor.querySelectorAll("[data-editor-links]").forEach((input) => {
      input.addEventListener("input", (event) => {
        resume.personal.links[Number(event.target.dataset.editorLinks)] = event.target.value;
        this.commit(resume);
      });
    });

    this.resumeEditor.querySelectorAll("[data-editor-list]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, (event) => {
        const listName = event.target.dataset.editorList;
        const index = Number(event.target.dataset.index);
        const field = event.target.dataset.field;
        resume[listName][index][field] = event.target.value;
        this.commit(resume);
      });
    });

    this.resumeEditor.querySelectorAll("[data-editor-remove]").forEach((button) => {
      button.addEventListener("click", (event) => {
        resume[event.target.dataset.editorRemove].splice(Number(event.target.dataset.index), 1);
        this.commit(resume);
      });
    });

    this.resumeEditor.querySelectorAll("[data-editor-remove-skill]").forEach((button) => {
      button.addEventListener("click", (event) => {
        resume.skills.splice(Number(event.target.dataset.editorRemoveSkill), 1);
        this.commit(resume);
      });
    });

    this.bindEditorAddButtons(resume);
    this.bindEditorSummaryButton(resume);
  }

  bindEditorAddButtons(resume) {
    const addLinkButton = document.getElementById("editor-add-link");
    if (addLinkButton) {
      addLinkButton.addEventListener("click", () => {
        resume.personal.links.push("");
        this.commit(resume);
      });
    }

    const addExperienceButton = document.getElementById("editor-add-experience");
    if (addExperienceButton) {
      addExperienceButton.addEventListener("click", () => {
        resume.experience.push({ title: "", subtitle: "", description: "", dateStarted: "", dateEnded: "" });
        this.commit(resume);
      });
    }

    const addEducationButton = document.getElementById("editor-add-education");
    if (addEducationButton) {
      addEducationButton.addEventListener("click", () => {
        resume.education.push({ title: "", degreeType: "Bachelors", startDate: "", endDate: "", address: "" });
        this.commit(resume);
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
        this.commit(resume);
      });
    }
  }

  bindEditorSummaryButton(resume) {
    const generateSummaryButton = document.getElementById("editor-generate-summary");
    if (!generateSummaryButton) {
      return;
    }

    generateSummaryButton.addEventListener("click", async () => {
      generateSummaryButton.disabled = true;
      generateSummaryButton.textContent = "Generating...";

      try {
        resume.personal.introduction = await this.app.llm.generateResumeSummary(resume);
      } catch (_error) {
        resume.personal.introduction = ResumeFactory.generateSummary(resume);
      }

      this.commit(resume);
    });
  }

  commit(resume) {
    ResumeFactory.updateMeta(resume);
    this.app.persistResume(resume);
    this.renderDetail();
  }

  async downloadPdf() {
    const resume = this.app.store.getResumeById(this.app.store.routeResumeId);
    if (!resume || !this.resumePreview) {
      return;
    }

    const html2canvasRef = window.html2canvas;
    const jsPdfRef = window.jspdf && window.jspdf.jsPDF;

    if (!html2canvasRef || !jsPdfRef) {
      if (this.downloadStatus) {
        this.downloadStatus.textContent = "PDF export library did not load. Refresh the page and try again.";
      }
      return;
    }

    this.downloadStatus.textContent = "Generating PDF...";
    this.downloadPdfButton.disabled = true;

    try {
      const canvas = await html2canvasRef(this.resumePreview, {
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
      this.downloadStatus.textContent = "PDF downloaded.";
    } catch (_error) {
      this.downloadStatus.textContent = "PDF export failed. Try again.";
    } finally {
      this.downloadPdfButton.disabled = false;
    }
  }
}

class ResumeApp {
  constructor() {
    this.store = new ResumeStore(STORAGE_KEY);
    this.api = new ApiClient();
    this.llm = new LLMService(this.api);
    this.profileMenu = new ProfileMenuController(this);
    this.dashboard = new DashboardController(this);
    this.builder = new ResumeBuilderController(this);
    this.templates = new TemplateModalController(this);
    this.resumeDetail = new ResumeDetailController(this);
  }

  initialize() {
    this.profileMenu.initialize();
    this.dashboard.initialize();
    this.builder.initialize();
    this.templates.initialize();
    this.resumeDetail.initialize();

    window.addEventListener("popstate", () => this.resolveRoute());

    this.dashboard.renderRecentResumes();
    this.profileMenu.loadUser();
    this.hydrateResumes();
    this.resolveRoute();
  }

  persistResume(resume) {
    this.store.upsertResume(resume);
    this.dashboard.renderRecentResumes();
  }

  async fetchResumeFromServer(resumeId) {
    const data = await this.api.fetchResumeById(resumeId);
    const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
    const resume = {
      ...payload,
      id: data.id,
      templateId: data.template_id || payload.templateId || null,
      title: data.title || payload.title,
      status: data.status || payload.status,
    };

    this.persistResume(resume);
    return resume;
  }

  async hydrateResumes() {
    try {
      const rows = await this.api.fetchResumes();
      rows.forEach((row) => {
        const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        const resume = {
          ...payload,
          id: row.id,
          templateId: row.template_id || payload.templateId || null,
          title: row.title || payload.title,
          status: row.status || payload.status,
        };

        this.store.upsertResume(resume);
      });

      this.dashboard.renderRecentResumes();

      if (this.store.routeResumeId) {
        this.resumeDetail.renderDetail();
      }
    } catch (_error) {
      // Keep local cached resumes if server hydration fails.
    }
  }

  openDashboard(pushHistory = true) {
    this.dashboard.showDashboard(pushHistory);
  }

  openResumeRoute(resumeId, pushHistory = true, templateId = null) {
    const resume = this.store.getResumeById(resumeId);
    if (resume && templateId && !resume.templateId) {
      resume.templateId = templateId;
      this.persistResume(resume);
    }

    this.dashboard.showResumePage();
    this.store.routeResumeId = resumeId;
    this.store.routeTemplateId = templateId || resume?.templateId || null;

    if (pushHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("resume", resumeId);

      if (this.store.routeTemplateId) {
        url.searchParams.set("template", this.store.routeTemplateId);
      } else {
        url.searchParams.delete("template");
      }

      window.history.pushState({}, "", url.toString());
    }

    this.resumeDetail.renderDetail();
  }

  resolveRoute() {
    const url = new URL(window.location.href);
    const resumeId = url.searchParams.get("resume");
    const templateId = url.searchParams.get("template");

    if (resumeId) {
      this.openResumeRoute(resumeId, false, templateId);
      return;
    }

    this.openDashboard(false);
  }
}

const app = new ResumeApp();
app.initialize();
