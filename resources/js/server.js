require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("./db");
const Registration = require("./registration");
const LLMService = require("../../llm/llm-service");
const AuthService = require("./auth-service");
const { seedResumeTemplates } = require("./template-seeds");

const app = express();
const port = Number(process.env.PORT || 3000);
const database = Database.getInstance();
const llm = new LLMService();
const authService = AuthService.getInstance();
const appRoot = path.resolve(__dirname, "..", "..");
const viewsDir = path.join(appRoot, "resources", "views");
const resourcesDir = path.join(appRoot, "resources");
const workspaceRoot = path.resolve(appRoot, "..");

function parseCookies(req) {
  const rawCookie = req.headers.cookie || "";
  return rawCookie.split(";").reduce((cookies, entry) => {
    const [key, ...rest] = entry.trim().split("=");
    if (!key) {
      return cookies;
    }

    cookies[key] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  return authService.getSession(cookies.resumeMakerSession);
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `resumeMakerSession=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "resumeMakerSession=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

async function getAccountSettingsByUserId(userId) {
  const [userInfoRows] = await database.run({
    table: "UserINFO",
    action: "SELECT",
    fields: ["user_id", "first_name", "last_name", "email", "address", "profession", "phone_number"],
    where: { user_id: userId },
    limit: 1,
  });

  const [accountRows] = await database.run({
    table: "users",
    action: "SELECT",
    fields: ["id", "name", "profile", "address", "subscription", "account_status"],
    where: { id: userId },
    limit: 1,
  });

  const userInfo = userInfoRows[0] || null;
  const account = accountRows[0] || null;

  if (!userInfo && !account) {
    return null;
  }

  return {
    id: userId,
    name: account?.name || `${userInfo?.first_name || ""} ${userInfo?.last_name || ""}`.trim(),
    profile: account?.profile || userInfo?.profession || "ResumeMaker user",
    address: account?.address || userInfo?.address || "",
    subscription: account?.subscription || "Free",
    account: account?.account_status || "Active",
    email: userInfo?.email || "",
    firstName: userInfo?.first_name || "",
    lastName: userInfo?.last_name || "",
    phoneNumber: userInfo?.phone_number || "",
    profession: userInfo?.profession || "",
  };
}

function requireAuth(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  req.session = session;
  next();
}

function requirePageAuth(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.redirect("/login");
    return;
  }

  req.session = session;
  next();
}

app.use((req, res, next) => {
  const protectedPagePaths = ["/", "/index.html", "/account-settings", "/account-settings.html", "/templates", "/templates.html"];
  if (!protectedPagePaths.includes(req.path)) {
    next();
    return;
  }

  requirePageAuth(req, res, next);
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/resources", express.static(resourcesDir, { index: false }));
app.use("/assets", express.static(path.join(workspaceRoot, "assets"), { index: false }));

app.get("/api/health", async (_req, res) => {
  try {
    await database.testConnection();
    res.json({
      ok: true,
      app: "ResumeMaker",
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      app: "ResumeMaker",
      database: "disconnected",
      message: error.message,
    });
  }
});

app.get("/api/resumes", requireAuth, async (_req, res) => {
  try {
    const [rows] = await database.run({
      table: "resumes",
      action: "SELECT",
      fields: ["id", "user_id", "template_id", "title", "status", "payload", "created_at", "updated_at"],
      where: { user_id: _req.session.user.userId },
      orderBy: "updated_at DESC",
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/resumes/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await database.run({
      table: "resumes",
      action: "SELECT",
      fields: ["id", "user_id", "template_id", "title", "status", "payload", "created_at", "updated_at"],
      where: { id: req.params.id, user_id: req.session.user.userId },
      limit: 1,
    });

    if (!rows.length) {
      res.status(404).json({ message: "Resume not found." });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/resumes", requireAuth, async (req, res) => {
  const { id, templateId = null, title, status, payload } = req.body;

  if (!id || !title || !status || !payload) {
    res.status(400).json({ message: "id, title, status, and payload are required." });
    return;
  }

  try {
    const ownerUserId = req.session.user.userId;
    const [existing] = await database.run({
      table: "resumes",
      action: "SELECT",
      fields: ["id", "user_id"],
      where: { id },
      limit: 1,
    });

    if (existing.length && existing[0].user_id && existing[0].user_id !== ownerUserId) {
      res.status(403).json({ message: "You do not have access to this resume." });
      return;
    }

    const data = {
      id,
      user_id: ownerUserId,
      template_id: templateId,
      title,
      status,
      payload: JSON.stringify(payload),
    };

    if (existing.length) {
      await database.run({
        table: "resumes",
        action: "UPDATE",
        data,
        where: { id },
      });
    } else {
      await database.run({
        table: "resumes",
        action: "INSERT",
        data,
      });
    }

    res.status(201).json({ ok: true, id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/users/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await database.run({
      table: "users",
      action: "SELECT",
      fields: ["id", "name", "profile", "address", "subscription", "account_status"],
      where: { id: req.params.id },
      limit: 1,
    });

    if (!rows.length) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res.json({
      ...rows[0],
      account: rows[0].account_status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/account-settings", requireAuth, async (req, res) => {
  try {
    const accountSettings = await getAccountSettingsByUserId(req.session.user.userId);

    if (!accountSettings) {
      res.status(404).json({ message: "Account settings not found." });
      return;
    }

    res.json(accountSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/account-settings", requireAuth, async (req, res) => {
  const { name, profile, address, subscription, account } = req.body;
  const userId = req.session.user.userId;

  if (!name || !profile || !address || !subscription || !account) {
    res.status(400).json({ message: "name, profile, address, subscription, and account are required." });
    return;
  }

  try {
    const nameParts = String(name).trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");

    await database.run({
      table: "UserINFO",
      action: "UPDATE",
      data: {
        first_name: firstName,
        last_name: lastName,
        address,
        profession: profile,
      },
      where: { user_id: userId },
    });

    const [existing] = await database.run({
      table: "users",
      action: "SELECT",
      fields: ["id"],
      where: { id: userId },
      limit: 1,
    });

    const accountData = {
      id: userId,
      name,
      profile,
      address,
      subscription,
      account_status: account,
    };

    if (existing.length) {
      await database.run({
        table: "users",
        action: "UPDATE",
        data: accountData,
        where: { id: userId },
      });
    } else {
      await database.run({
        table: "users",
        action: "INSERT",
        data: accountData,
      });
    }

    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;

    res.json({ ok: true, accountSettings: await getAccountSettingsByUserId(userId) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/users", requireAuth, async (req, res) => {
  const { id, name, profile, address, subscription, account } = req.body;

  if (!id || !name || !profile || !address || !subscription || !account) {
    res.status(400).json({ message: "All user fields are required." });
    return;
  }

  try {
    const [existing] = await database.run({
      table: "users",
      action: "SELECT",
      fields: ["id"],
      where: { id },
      limit: 1,
    });

    const data = {
      id,
      name,
      profile,
      address,
      subscription,
      account_status: account,
    };

    if (existing.length) {
      await database.run({
        table: "users",
        action: "UPDATE",
        data,
        where: { id },
      });
    } else {
      await database.run({
        table: "users",
        action: "INSERT",
        data,
      });
    }

    res.status(201).json({ ok: true, id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/register", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    address,
    password,
    profession = null,
    phoneNumber = null,
  } = req.body;

  try {
    const registration = new Registration(
      firstName,
      lastName,
      email,
      address,
      password,
      profession,
      phoneNumber
    );
    const dto = await registration.save();
    const token = authService.createSession({
      userId: dto.userId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });
    setSessionCookie(res, token);
    res.status(201).json({ ok: true, user: dto });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  try {
    const [rows] = await database.run({
      table: "UserINFO",
      action: "SELECT",
      fields: ["user_id", "first_name", "last_name", "email", "password_hash"],
      where: { email },
      limit: 1,
    });

    if (!rows.length) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const user = rows[0];
    const isValid = Registration.verifyPassword(password, user.password_hash);

    if (!isValid) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const sessionUser = {
      userId: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    };
    const token = authService.createSession(sessionUser);
    setSessionCookie(res, token);

    res.json({
      ok: true,
      user: sessionUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/llm/respond", requireAuth, async (req, res) => {
  const { input, instructions = "", model } = req.body;

  if (!input) {
    res.status(400).json({ message: "input is required." });
    return;
  }

  try {
    const result = await llm.generateText({ input, instructions, model });
    res.json({
      ok: true,
      id: result.id,
      text: result.text,
    });
  } catch (error) {
    const status = error.message.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ message: error.message });
  }
});

app.post("/api/llm/resume-summary", requireAuth, async (req, res) => {
  const { resume } = req.body;

  if (!resume) {
    res.status(400).json({ message: "resume is required." });
    return;
  }

  try {
    const result = await llm.generateResumeSummary(resume);
    res.json({
      ok: true,
      id: result.id,
      text: result.text,
    });
  } catch (error) {
    const status = error.message.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ message: error.message });
  }
});

app.get("/api/templates/previews", requireAuth, async (_req, res) => {
  try {
    const [rows] = await database.run({
      table: "ResumeTemplates",
      action: "SELECT",
      fields: ["template_id", "name", "preview_image_url", "sort_order"],
      orderBy: "sort_order ASC",
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/templates/:templateId", requireAuth, async (req, res) => {
  try {
    const [rows] = await database.run({
      table: "ResumeTemplates",
      action: "SELECT",
      fields: ["template_id", "user_id", "name", "html_markup", "css_styles", "preview_image_url", "sort_order"],
      where: { template_id: req.params.templateId },
      limit: 1,
    });

    if (!rows.length) {
      res.status(404).json({ message: "Template not found." });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/templates/select", requireAuth, async (req, res) => {
  const { templateId } = req.body;

  if (!templateId) {
    res.status(400).json({ message: "templateId is required." });
    return;
  }

  try {
    await database.run({
      table: "ResumeTemplates",
      action: "UPDATE",
      data: {
        user_id: req.session.user.userId,
      },
      where: { template_id: templateId },
    });

    const [rows] = await database.run({
      table: "ResumeTemplates",
      action: "SELECT",
      fields: ["template_id", "user_id", "name", "html_markup", "css_styles", "preview_image_url", "sort_order"],
      where: { template_id: templateId },
      limit: 1,
    });

    if (!rows.length) {
      res.status(404).json({ message: "Template not found." });
      return;
    }

    res.json({ ok: true, template: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const [resumeRows] = await database.run({
      table: "resumes",
      action: "SELECT",
      fields: ["id", "title", "status", "updated_at"],
      where: { user_id: userId },
      orderBy: "updated_at DESC",
    });

    const [notificationRows] = await database.run({
      table: "notifications",
      action: "SELECT",
      fields: ["id", "type", "title", "message", "resume_id", "is_open", "created_at"],
      where: { user_id: userId, is_open: 1 },
      orderBy: "created_at DESC",
    });

    const resumeNotifications = resumeRows
      .filter((resume) => String(resume.status).trim().toLowerCase() !== "completed")
      .map((resume) => ({
        id: `resume-${resume.id}`,
        type: "resume",
        title: `Finish ${resume.title}`,
        message: `Resume ${resume.id} is saved but not completed yet.`,
        resumeId: resume.id,
        source: "resume",
        createdAt: resume.updated_at,
      }));

    const pushedNotifications = notificationRows.map((notification) => ({
      id: `notification-${notification.id}`,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      resumeId: notification.resume_id,
      source: "api",
      createdAt: notification.created_at,
    }));

    const items = [...resumeNotifications, ...pushedNotifications].sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    });

    res.json({
      ok: true,
      items,
      openCount: items.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/notifications/push", requireAuth, async (req, res) => {
  const {
    title,
    message,
    resumeId = null,
    type = "system",
  } = req.body;

  if (!title || !message) {
    res.status(400).json({ message: "title and message are required." });
    return;
  }

  try {
    await database.run({
      table: "notifications",
      action: "INSERT",
      data: {
        user_id: req.session.user.userId,
        type,
        title,
        message,
        resume_id: resumeId,
        is_open: 1,
      },
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/logout", requireAuth, (req, res) => {
  const cookies = parseCookies(req);
  authService.destroySession(cookies.resumeMakerSession);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/session", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.session.user });
});

app.get("/", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(viewsDir, "index.html"));
});

app.get("/index.html", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(viewsDir, "index.html"));
});

app.get("/account-settings", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(viewsDir, "account-settings.html"));
});

app.get("/account-settings.html", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(viewsDir, "account-settings.html"));
});

app.get("/templates", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(viewsDir, "templates.html"));
});

app.get("/templates.html", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(viewsDir, "templates.html"));
});

app.get("/register", (_req, res) => {
  res.sendFile(path.join(viewsDir, "registration.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(viewsDir, "login.html"));
});

async function start() {
  try {
    await database.initializeSchema();
    await seedResumeTemplates(database);
    await database.testConnection();
    app.listen(port, () => {
      console.log(`ResumeMaker server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

start();
