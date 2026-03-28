const express = require("express");
const multer = require("multer");
const fs = require("fs");
const convert = require("./convert");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));

app.post("/convert", upload.single("file"), async (req, res) => {
  try {
    const mdContent = fs.readFileSync(req.file.path, "utf8");
    const pdfPath = `uploads/${Date.now()}.pdf`;

    await convert(mdContent, pdfPath);

    res.download(pdfPath, "output.pdf", () => {
      setTimeout(() => {
        fs.unlink(req.file.path, () => {});
        fs.unlink(pdfPath, () => {});
      }, 500);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error converting file");
  }
});

app.listen(3050, () => {
  console.log("🚀 Server running on http://localhost:3050");
});