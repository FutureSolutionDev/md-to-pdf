import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { mkdirSync, existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, basename } from "node:path";
import convert from "./convert";
import * as auth from "./auth.js";
import * as files from "./files.js";

if (!existsSync("uploads")) mkdirSync("uploads", { recursive: true });
if (!existsSync("storage")) mkdirSync("storage", { recursive: true });

const app = new Hono();
const jobs = new Map();

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const JOB_TTL = 10 * 60 * 1000;
const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL) {
      unlink(job.mdPath).catch(() => {});
      unlink(job.pdfPath).catch(() => {});
      jobs.delete(id);
    }
  }
}, CLEANUP_INTERVAL);

app.onError((err, c) => {
  console.error("[Server Error]", err.message);
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/health", (c) => c.json({ status: "ok" }));

// Auth middleware - reads session cookie for all /api/* routes
app.use("/api/*", async (c, next) => {
  const sessionToken = getCookie(c, "session");
  const user = sessionToken ? auth.verifySession(sessionToken) : null;
  c.set("user", user);
  await next();
});

app.post("/api/auth/register", async (c) => {
  const { name, email, password } = await c.req.json();
  try {
    const { user, token } = await auth.register(name, email, password);
    setCookie(c, "session", token, auth.cookieOptions);
    return c.json({ user });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});

app.post("/api/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  try {
    const { user, token } = await auth.login(email, password);
    setCookie(c, "session", token, auth.cookieOptions);
    return c.json({ user });
  } catch (err) {
    return c.json({ error: err.message }, 401);
  }
});

app.post("/api/auth/logout", (c) => {
  const token = getCookie(c, "session");
  auth.logout(token);
  deleteCookie(c, "session");
  return c.json({ ok: true });
});

app.get("/api/auth/me", (c) => {
  const user = c.get("user");
  return c.json({ user: user || null });
});

app.post("/api/files/save/:jobId", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);
  if (!job) return c.json({ error: "Job not found" }, 404);
  if (job.status !== "done") return c.json({ error: "Job not complete" }, 400);

  try {
    const file = await files.saveFile(user.id, job.pdfPath, job.originalName);
    return c.json({ file });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});

app.get("/api/files", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userFiles = files.getUserFiles(user.id);
  return c.json({ files: userFiles });
});

app.get("/api/files/:id", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const fileId = c.req.param("id");
  const file = files.getFile(fileId, user.id);
  if (!file) return c.json({ error: "File not found" }, 404);

  return c.json({ file });
});

app.get("/api/files/:id/download", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const fileId = c.req.param("id");
  const file = files.getFile(fileId, user.id);
  if (!file) return c.json({ error: "File not found" }, 404);

  const fileData = await Bun.file(file.pdf_path).arrayBuffer();
  return new Response(fileData, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
    }
  });
});

app.delete("/api/files/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const fileId = c.req.param("id");
  try {
    await files.deleteFile(fileId, user.id);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});

app.get("/api/storage", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const storage = files.getUserStorage(user.id);
  return c.json(storage);
});

// I18n route - serve translation files
app.get("/api/i18n/:lang", async (c) => {
  const lang = c.req.param("lang");
  if (lang !== "ar" && lang !== "en") {
    return c.json({ error: "Language not supported" }, 400);
  }

  const filePath = `src/i18n/${lang}.json`;
  if (!existsSync(filePath)) {
    return c.json({ error: "Translation not found" }, 404);
  }

  const content = await Bun.file(filePath).text();
  return c.text(content, 200, { "Content-Type": "application/json" });
});

// Convert route
app.post("/convert", async (c) => {
  let body;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: "فشل في قراءة البيانات المرسلة" }, 400);
  }

  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "لم يتم رفع أي ملف" }, 400);
  }

  if (!file.name.endsWith(".md")) {
    return c.json({ error: "يجب أن يكون الملف بصيغة .md" }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "حجم الملف يتجاوز الحد المسموح (10MB)" }, 400);
  }

  if (file.size === 0) {
    return c.json({ error: "الملف فارغ" }, 400);
  }

  const jobId = Date.now().toString();
  const mdPath = `uploads/${jobId}.md`;
  const pdfPath = `uploads/${jobId}.pdf`;
  const originalName = basename(file.name, extname(file.name)) + ".pdf";

  const user = c.get("user");

  try {
    await Bun.write(mdPath, await file.arrayBuffer());
  } catch {
    return c.json({ error: "فشل في حفظ الملف" }, 500);
  }

  jobs.set(jobId, {
    status: "processing",
    logs: [],
    pdfPath,
    mdPath,
    originalName,
    createdAt: Date.now(),
    userId: user?.id,
  });

  // بدء التحويل في الخلفية
  (async () => {
    try {
      const mdContent = await Bun.file(mdPath).text();

      await convert(mdContent, pdfPath, (percent, message) => {
        const job = jobs.get(jobId);
        if (job) job.logs.push({ percent, message });
      });

      const job = jobs.get(jobId);
      if (job) job.status = "done";
    } catch (err) {
      console.error(`[Job ${jobId}]`, err.message);
      const job = jobs.get(jobId);
      if (job) {
        job.status = "error";
        job.errorMessage = err.message;
        job.logs.push({ percent: 0, message: `خطأ: ${err.message}` });
      }
      // تنظيف الملفات عند الخطأ
      unlink(mdPath).catch(() => {});
      unlink(pdfPath).catch(() => {});
    }
  })();

  return c.json({ jobId });
});

app.get("/stream/:jobId", (c) => {
  const jobId = c.req.param("jobId");

  if (!jobs.has(jobId)) {
    return c.json({ error: "Job not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    let lastIndex = 0;
    let ticks = 0;
    const maxTicks = 600;

    while (ticks++ < maxTicks) {
      const job = jobs.get(jobId);

      if (!job) {
        await stream.writeSSE({
          data: JSON.stringify({ error: true, message: "Job not found" }),
        });
        return;
      }

      while (lastIndex < job.logs.length) {
        await stream.writeSSE({ data: JSON.stringify(job.logs[lastIndex++]) });
      }

      if (job.status === "done") {
        await stream.writeSSE({ data: JSON.stringify({ done: true }) });
        return;
      }

      if (job.status === "error") {
        await stream.writeSSE({
          data: JSON.stringify({ error: true, message: job.errorMessage || "فشل التحويل" }),
        });
        return;
      }

      await stream.sleep(200);
    }

    await stream.writeSSE({
      data: JSON.stringify({ error: true, message: "انتهت مهلة التحويل" }),
    });
  });
});

app.get("/download/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  if (job.status !== "done") {
    return c.json({ error: "الملف ليس جاهزاً بعد" }, 404);
  }

  let fileData;
  try {
    fileData = await Bun.file(job.pdfPath).arrayBuffer();
  } catch {
    return c.json({ error: "فشل في قراءة ملف الـ PDF" }, 500);
  }

  // Check if user is logged in for cleanup delay
  const sessionToken = getCookie(c, "session");
  const user = sessionToken ? auth.verifySession(sessionToken) : null;
  const cleanupDelay = user ? 5 * 60 * 1000 : 500; // 5 min for logged in, 500ms for guests

  setTimeout(() => {
    unlink(job.mdPath).catch(() => {});
    unlink(job.pdfPath).catch(() => {});
    jobs.delete(jobId);
  }, cleanupDelay);

  return new Response(fileData, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.originalName)}`,
    },
  });
});

// Static files
app.use("/assets/*", serveStatic({ root: "./public" }));
app.use("/pages/*", serveStatic({ root: "./public" }));
app.use("*", serveStatic({ root: "./public" }));

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

const server = Bun.serve({
  port: process.env.PORT || 3050,
  fetch: app.fetch,
});

console.log(`Server running on http://localhost:${server.port}`);