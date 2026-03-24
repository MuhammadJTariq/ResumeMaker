function buildPreviewDataUrl(label, primary, secondary) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
      <rect width="320" height="420" fill="#ffffff"/>
      <rect width="96" height="420" fill="${primary}"/>
      <rect x="116" y="40" width="164" height="16" rx="8" fill="${secondary}"/>
      <rect x="116" y="72" width="128" height="8" rx="4" fill="#cbd5e1"/>
      <rect x="24" y="40" width="48" height="48" rx="24" fill="#ffffff22"/>
      <rect x="24" y="108" width="48" height="8" rx="4" fill="#ffffff66"/>
      <rect x="24" y="126" width="40" height="8" rx="4" fill="#ffffff44"/>
      <rect x="116" y="120" width="160" height="10" rx="5" fill="#94a3b8"/>
      <rect x="116" y="144" width="144" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="116" y="176" width="160" height="10" rx="5" fill="#94a3b8"/>
      <rect x="116" y="200" width="132" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="116" y="248" width="150" height="10" rx="5" fill="#94a3b8"/>
      <rect x="116" y="272" width="122" height="8" rx="4" fill="#e2e8f0"/>
      <text x="116" y="348" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${primary}">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildTemplate(config) {
  return {
    template_id: config.id,
    name: config.name,
    html_markup: `
      <div class="template-shell ${config.className}">
        <aside class="template-sidebar">
          <h1>{{fullName}}</h1>
          <p>{{email}}</p>
          <p>{{phone}}</p>
          <p>{{address}}</p>
          <p>{{cityCountry}}</p>
          <div class="template-links">{{links}}</div>
        </aside>
        <main class="template-main">
          <section class="template-section">
            <h2>Profile</h2>
            <p>{{summary}}</p>
          </section>
          <section class="template-section">
            <h2>Experience</h2>
            {{experienceItems}}
          </section>
          <section class="template-section">
            <h2>Education</h2>
            {{educationItems}}
          </section>
          <section class="template-section">
            <h2>Skills</h2>
            <div class="template-skill-list">{{skillItems}}</div>
          </section>
        </main>
      </div>
    `.trim(),
    css_styles: `
      .template-shell.${config.className} {
        display: grid;
        grid-template-columns: ${config.columns};
        min-height: 100%;
        background: ${config.background};
        color: ${config.text};
        font-family: ${config.font};
      }
      .template-shell.${config.className} .template-sidebar {
        padding: 32px 24px;
        background: ${config.sidebar};
        color: ${config.sidebarText};
      }
      .template-shell.${config.className} .template-sidebar h1 {
        margin: 0 0 16px;
        font-size: 2rem;
        letter-spacing: -0.05em;
      }
      .template-shell.${config.className} .template-sidebar p {
        margin: 0 0 8px;
        line-height: 1.5;
      }
      .template-shell.${config.className} .template-main {
        padding: 32px 28px;
      }
      .template-shell.${config.className} .template-section {
        margin-bottom: 24px;
      }
      .template-shell.${config.className} .template-section h2 {
        margin: 0 0 12px;
        color: ${config.accent};
        font-size: 0.95rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .template-shell.${config.className} .template-entry {
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid ${config.divider};
      }
      .template-shell.${config.className} .template-entry:last-child {
        border-bottom: 0;
        margin-bottom: 0;
        padding-bottom: 0;
      }
      .template-shell.${config.className} .template-entry-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .template-shell.${config.className} .template-entry h3 {
        margin: 0 0 4px;
        font-size: 1rem;
      }
      .template-shell.${config.className} .template-entry small {
        color: ${config.muted};
      }
      .template-shell.${config.className} .template-entry p {
        margin: 8px 0 0;
        line-height: 1.6;
      }
      .template-shell.${config.className} .template-skill-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .template-shell.${config.className} .template-skill {
        padding: 8px 12px;
        border-radius: 999px;
        background: ${config.skillBg};
        color: ${config.skillText};
        font-weight: 700;
      }
      .template-shell.${config.className} .template-link {
        display: inline-block;
        margin: 6px 6px 0 0;
        padding: 6px 10px;
        border-radius: 999px;
        background: ${config.linkBg};
        color: ${config.linkText};
        font-size: 0.82rem;
      }
    `.trim(),
    preview_image_url: buildPreviewDataUrl(config.name, config.sidebar, config.accent),
    sort_order: config.sortOrder,
  };
}

const templateConfigs = [
  { id: "classic-column-01", name: "Classic Column", className: "tpl-classic-column", columns: "30% 70%", background: "#fffefc", text: "#14211d", sidebar: "#0f766e", sidebarText: "#f7fffd", accent: "#0f766e", divider: "#d6e4df", muted: "#5f766f", skillBg: "#ddf4ef", skillText: "#115e59", linkBg: "#ffffff20", linkText: "#ffffff", font: "'Trebuchet MS', sans-serif", sortOrder: 1 },
  { id: "midnight-slate-02", name: "Midnight Slate", className: "tpl-midnight-slate", columns: "34% 66%", background: "#f8fafc", text: "#0f172a", sidebar: "#1e293b", sidebarText: "#e2e8f0", accent: "#334155", divider: "#cbd5e1", muted: "#64748b", skillBg: "#e2e8f0", skillText: "#1e293b", linkBg: "#ffffff12", linkText: "#e2e8f0", font: "Georgia, serif", sortOrder: 2 },
  { id: "sunrise-band-03", name: "Sunrise Band", className: "tpl-sunrise-band", columns: "28% 72%", background: "#fff7ed", text: "#3b2f2f", sidebar: "#f97316", sidebarText: "#fff7ed", accent: "#ea580c", divider: "#fed7aa", muted: "#9a6b49", skillBg: "#ffedd5", skillText: "#9a3412", linkBg: "#ffffff20", linkText: "#fff7ed", font: "'Segoe UI', sans-serif", sortOrder: 3 },
  { id: "forest-profile-04", name: "Forest Profile", className: "tpl-forest-profile", columns: "32% 68%", background: "#f0fdf4", text: "#163021", sidebar: "#166534", sidebarText: "#f0fdf4", accent: "#15803d", divider: "#bbf7d0", muted: "#4d7c5a", skillBg: "#dcfce7", skillText: "#166534", linkBg: "#ffffff1f", linkText: "#f0fdf4", font: "'Aptos', sans-serif", sortOrder: 4 },
  { id: "royal-edge-05", name: "Royal Edge", className: "tpl-royal-edge", columns: "35% 65%", background: "#faf5ff", text: "#2e1065", sidebar: "#6d28d9", sidebarText: "#f5f3ff", accent: "#7c3aed", divider: "#ddd6fe", muted: "#7e6aa8", skillBg: "#ede9fe", skillText: "#5b21b6", linkBg: "#ffffff1a", linkText: "#f5f3ff", font: "'Cambria', serif", sortOrder: 5 },
  { id: "charcoal-line-06", name: "Charcoal Line", className: "tpl-charcoal-line", columns: "26% 74%", background: "#f8fafc", text: "#111827", sidebar: "#111827", sidebarText: "#f9fafb", accent: "#374151", divider: "#d1d5db", muted: "#6b7280", skillBg: "#e5e7eb", skillText: "#111827", linkBg: "#ffffff14", linkText: "#f9fafb", font: "'Arial', sans-serif", sortOrder: 6 },
  { id: "berry-glass-07", name: "Berry Glass", className: "tpl-berry-glass", columns: "31% 69%", background: "#fff1f2", text: "#4c0519", sidebar: "#be123c", sidebarText: "#fff1f2", accent: "#e11d48", divider: "#fecdd3", muted: "#9f5467", skillBg: "#ffe4e6", skillText: "#9f1239", linkBg: "#ffffff1c", linkText: "#fff1f2", font: "'Calibri', sans-serif", sortOrder: 7 },
  { id: "ocean-grid-08", name: "Ocean Grid", className: "tpl-ocean-grid", columns: "29% 71%", background: "#eff6ff", text: "#172554", sidebar: "#1d4ed8", sidebarText: "#eff6ff", accent: "#2563eb", divider: "#bfdbfe", muted: "#5b73b3", skillBg: "#dbeafe", skillText: "#1d4ed8", linkBg: "#ffffff1e", linkText: "#eff6ff", font: "'Verdana', sans-serif", sortOrder: 8 },
  { id: "sandstone-pro-09", name: "Sandstone Pro", className: "tpl-sandstone-pro", columns: "33% 67%", background: "#fffbeb", text: "#422006", sidebar: "#a16207", sidebarText: "#fffbeb", accent: "#ca8a04", divider: "#fde68a", muted: "#8d6b2e", skillBg: "#fef3c7", skillText: "#92400e", linkBg: "#ffffff1e", linkText: "#fffbeb", font: "'Book Antiqua', serif", sortOrder: 9 },
  { id: "mono-lite-10", name: "Mono Lite", className: "tpl-mono-lite", columns: "27% 73%", background: "#fafafa", text: "#171717", sidebar: "#525252", sidebarText: "#fafafa", accent: "#404040", divider: "#d4d4d4", muted: "#737373", skillBg: "#e5e5e5", skillText: "#262626", linkBg: "#ffffff18", linkText: "#fafafa", font: "'Courier New', monospace", sortOrder: 10 },
];

function getResumeTemplates() {
  return templateConfigs.map(buildTemplate);
}

async function seedResumeTemplates(database) {
  const templates = getResumeTemplates();

  for (const template of templates) {
    const [existing] = await database.run({
      table: "ResumeTemplates",
      action: "SELECT",
      fields: ["template_id"],
      where: { template_id: template.template_id },
      limit: 1,
    });

    const data = {
      template_id: template.template_id,
      name: template.name,
      html_markup: template.html_markup,
      css_styles: template.css_styles,
      preview_image_url: template.preview_image_url,
      sort_order: template.sort_order,
    };

    if (existing.length) {
      await database.run({
        table: "ResumeTemplates",
        action: "UPDATE",
        data,
        where: { template_id: template.template_id },
      });
    } else {
      await database.run({
        table: "ResumeTemplates",
        action: "INSERT",
        data,
      });
    }
  }
}

module.exports = {
  seedResumeTemplates,
};
