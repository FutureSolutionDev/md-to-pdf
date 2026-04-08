import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import toc from "markdown-it-table-of-contents";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

async function convert(mdContent, pdfFile, onLog = () => {}) {
  onLog(10, "جاري تحليل الـ Markdown...");

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
  })
    .use(anchor)
    .use(toc);

  const htmlContent = md.render(mdContent);

  onLog(30, "جاري بناء هيكل HTML...");

  const fullHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">

<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;800&family=Noto+Sans+Mono&display=swap" rel="stylesheet">

<style>
  /* ===== Base ===== */
  body {
    font-family: 'Cairo', Arial, sans-serif;
    direction: rtl;
    text-align: right;
    padding: 10px 20px;
    max-width: 860px;
    margin: auto;
    line-height: 1.9;
    color: #2d3748;
    background: #fff;
    font-size: 14px;
  }

  /* ===== H1 — Navy banner ===== */
  h1 {
    font-size: 24px;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(135deg, #1e3a5f 0%, #2e5c99 100%);
    padding: 16px 24px;
    border-radius: 10px;
    margin: 36px 0 20px;
    page-break-after: avoid;
  }

  /* ===== H2 — Gold right border + light blue bg ===== */
  h2 {
    font-size: 19px;
    font-weight: 700;
    color: #1e3a5f;
    border-right: 5px solid #c9a227;
    padding: 8px 16px;
    margin: 30px 0 14px;
    background: #f0f5ff;
    border-radius: 0 8px 8px 0;
    page-break-after: avoid;
  }

  /* ===== H3 — Thin gold right border ===== */
  h3 {
    font-size: 16px;
    font-weight: 700;
    color: #1e3a5f;
    border-right: 3px solid #c9a227;
    padding-right: 12px;
    margin: 22px 0 10px;
    page-break-after: avoid;
  }

  /* ===== H4 ===== */
  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #2e5c99;
    margin: 16px 0 8px;
  }

  /* ===== Dividers ===== */
  hr {
    border: none;
    height: 2px;
    background: linear-gradient(to left, transparent, #c9a227, transparent);
    margin: 28px 0;
    opacity: 0.5;
  }

  /* ===== Tables ===== */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13px;
  }

  th {
    background: #1e3a5f;
    color: #fff;
    padding: 10px 14px;
    text-align: right;
    font-weight: 600;
    border: 1px solid #1e3a5f;
  }

  td {
    border: 1px solid #e2e8f0;
    padding: 10px 14px;
    text-align: right;
  }

  tr:nth-child(even) td {
    background: #f7faff;
  }

  /* ===== Lists ===== */
  ul, ol {
    padding-right: 24px;
    padding-left: 0;
    margin: 10px 0;
  }

  li {
    margin: 5px 0;
    line-height: 1.8;
  }

  ul li::marker {
    color: #c9a227;
    font-size: 1.1em;
  }

  /* ===== Code blocks ===== */
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 18px;
    border-radius: 10px;
    overflow-x: auto;
    direction: rtl;
    text-align: right;
    font-family: 'Noto Sans Mono', 'Courier New', 'Cairo', Arial, monospace;
    unicode-bidi: embed;
    font-size: 13px;
    border-right: 4px solid #c9a227;
  }

  code {
    background: #eef2ff;
    color: #1e3a5f;
    padding: 2px 7px;
    border-radius: 5px;
    font-family: 'Noto Sans Mono', 'Courier New', monospace;
    font-size: 13px;
  }

  pre code {
    background: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }

  /* ===== Blockquote ===== */
  blockquote {
    border-right: 4px solid #c9a227;
    background: #fffbeb;
    padding: 12px 16px;
    color: #555;
    margin: 16px 0;
    border-radius: 0 8px 8px 0;
  }

  /* ===== Inline ===== */
  strong {
    color: #1e3a5f;
    font-weight: 700;
  }

  a {
    color: #2563eb;
    text-decoration: none;
  }

  img {
    max-width: 100%;
    border-radius: 8px;
  }

  /* ===== Page Breaks ===== */
  h1, h2, h3, h4 {
    page-break-after: avoid;
    break-after: avoid-page;
  }

  h1 + *, h2 + *, h3 + *, h4 + * {
    page-break-before: avoid;
    break-before: avoid-page;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
  }

  p {
    orphans: 3;
    widows: 3;
  }
</style>
</head>

<body>
${htmlContent}
</body>
</html>
`;

  onLog(50, "جاري تشغيل المتصفح...");

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  onLog(70, "جاري تحميل المحتوى والخطوط...");

  await page.setContent(fullHtml, { waitUntil: "networkidle0" });

  onLog(85, "جاري إنشاء الـ PDF...");

  await page.pdf({
    path: pdfFile,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="width:100%; height:6px; background:linear-gradient(to right,#1e3a5f,#c9a227); margin:0;"></div>`,
    footerTemplate: `
      <div style="width:100%; font-family:Arial,sans-serif; font-size:9px; color:#999;
                  display:flex; justify-content:space-between; padding:0 15mm; box-sizing:border-box; border-top:1px solid #eee;">
        <span>فريق التطوير</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    margin: {
      top: "18mm",
      right: "15mm",
      bottom: "18mm",
      left: "15mm",
    },
  });

  await browser.close();

  onLog(100, "✅ تم إنشاء الـ PDF بنجاح");
}

export default convert;

