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

// تنظيف الـ jobs القديمة كل دقيقة
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 10 * 60 * 1000) {
      unlink(job.mdPath).catch(() => {});
      unlink(job.pdfPath).catch(() => {});
      jobs.delete(id);
    }
  }
}, 60_000);

// POST /convert
app.post("/convert", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const jobId = Date.now().toString();
  const mdPath = `uploads/${jobId}.md`;
  const pdfPath = `uploads/${jobId}.pdf`;
  const originalName = basename(file.name, extname(file.name)) + ".pdf";

  await Bun.write(mdPath, await file.arrayBuffer());

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
      console.error(err);
      const job = jobs.get(jobId);
      if (job) {
        job.status = "error";
        job.logs.push({ percent: 0, message: `❌ خطأ: ${err.message}` });
      }
    }
  })();

  return c.json({ jobId });
});

// GET /stream/:jobId — SSE
app.get("/stream/:jobId", (c) => {
  const jobId = c.req.param("jobId");

  return streamSSE(c, async (stream) => {
    let lastIndex = 0;

    while (true) {
      const job = jobs.get(jobId);

      if (!job) {
        await stream.writeSSE({
          data: JSON.stringify({ error: "Job not found" }),
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
        await stream.writeSSE({ data: JSON.stringify({ error: true }) });
        return;
      }

      await stream.sleep(200);
    }
  });
});

// GET /download/:jobId
app.get("/download/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);

  if (!job || job.status !== "done") {
    return c.text("Not ready", 404);
  }

  const fileData = await Bun.file(job.pdfPath).arrayBuffer();

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

const server = Bun.serve({
  port: process.env.PORT || 3050,
  fetch: app.fetch,
});
console.log(`🚀 Server running on http://localhost:${server.port}`);
// md.futuresolutionsdev.com
