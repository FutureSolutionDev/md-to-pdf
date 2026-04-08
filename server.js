import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { mkdirSync, existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, basename } from "node:path";
import convert from "./convert";

if (!existsSync("uploads")) mkdirSync("uploads", { recursive: true });

const app = new Hono();
const jobs = new Map();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const JOB_TTL = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL = 60_000; // 1 minute

// تنظيف الـ jobs القديمة كل دقيقة
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

// Global error handler
app.onError((err, c) => {
  console.error("[Server Error]", err.message);
  return c.json({ error: "حدث خطأ داخلي في السيرفر" }, 500);
});

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// POST /convert
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

// GET /stream/:jobId — SSE
app.get("/stream/:jobId", (c) => {
  const jobId = c.req.param("jobId");

  if (!jobs.has(jobId)) {
    return c.json({ error: "Job not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    let lastIndex = 0;
    let ticks = 0;
    const maxTicks = 600; // 2 minutes max (600 * 200ms)

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

    // Timeout
    await stream.writeSSE({
      data: JSON.stringify({ error: true, message: "انتهت مهلة التحويل" }),
    });
  });
});

// GET /download/:jobId
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

  // تنظيف بعد التحميل
  setTimeout(() => {
    unlink(job.mdPath).catch(() => {});
    unlink(job.pdfPath).catch(() => {});
    jobs.delete(jobId);
  }, 500);

  return new Response(fileData, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.originalName)}`,
    },
  });
});

// Static files
app.use("*", serveStatic({ root: "./public" }));

// Process-level error handlers
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
