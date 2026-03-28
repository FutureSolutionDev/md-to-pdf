const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const convert = require("./convert");

const app = express();
const upload = multer({ dest: "uploads/" });
const jobs = new Map();

// تنظيف الـ jobs القديمة كل دقيقة
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 10 * 60 * 1000) {
      fs.unlink(job.mdPath, () => {});
      fs.unlink(job.pdfPath, () => {});
      jobs.delete(id);
    }
  }
}, 60 * 1000);

app.use(express.static("public"));

app.post("/convert", upload.single("file"), async (req, res) => {
  const jobId = Date.now().toString();
  const mdPath = req.file.path;
  const pdfPath = `uploads/${jobId}.pdf`;
  const originalName =
    path.basename(req.file.originalname, path.extname(req.file.originalname)) +
    ".pdf";

  jobs.set(jobId, {
    status: "processing",
    logs: [],
    pdfPath,
    mdPath,
    originalName,
    createdAt: Date.now(),
  });

  res.json({ jobId });

  const mdContent = fs.readFileSync(mdPath, "utf8");

  try {
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
});

app.get("/stream/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastIndex = 0;
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(() => {
    const job = jobs.get(jobId);

    if (!job) {
      send({ error: "Job not found" });
      clearInterval(interval);
      return res.end();
    }

    while (lastIndex < job.logs.length) {
      send(job.logs[lastIndex++]);
    }

    if (job.status === "done") {
      send({ done: true });
      clearInterval(interval);
      res.end();
    } else if (job.status === "error") {
      send({ error: true });
      clearInterval(interval);
      res.end();
    }
  }, 200);

  req.on("close", () => clearInterval(interval));
});

app.get("/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job || job.status !== "done") {
    return res.status(404).send("Not ready");
  }

  res.download(job.pdfPath, job.originalName, () => {
    setTimeout(() => {
      fs.unlink(job.mdPath, () => {});
      fs.unlink(job.pdfPath, () => {});
      jobs.delete(jobId);
    }, 500);
  });
});

app.listen(3050, () => {
  console.log("🚀 Server running on http://localhost:3050");
});
