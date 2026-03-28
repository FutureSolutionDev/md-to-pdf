# MD → PDF Converter

تحويل ملفات Markdown إلى PDF احترافي مع دعم كامل للعربية واتجاه RTL.

---

## Screenshots

![الواجهة الرئيسية](screenshots/main.png)

![بعد التحويل](screenshots/success.png)

---

## المميزات

- **Drag & Drop** — اسحب الملف مباشرة أو اختره من المتصفح
- **Real-time Progress** — شريط تقدم حي + سجل عمليات live بـ SSE
- **دعم عربي كامل** — RTL، خط Cairo، تنسيق احترافي
- **تنسيق PDF متقدم** — H1/H2/H3 بألوان Navy & Gold، جداول، code blocks
- **اسم الملف محفوظ** — PDF يخرج بنفس اسم الملف المدخل
- **تنظيم الصفحات** — heading لا ينفصل عن محتواه عند التقطيع

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Hono](https://hono.dev) |
| PDF Engine | [Puppeteer](https://pptr.dev) |
| Markdown Parser | [markdown-it](https://markdown-it.github.io) + anchor + TOC |
| Fonts | Cairo (Arabic) · Noto Sans Mono (code) |

---

## التثبيت والتشغيل

```bash
# تثبيت الـ dependencies
bun install

# تشغيل السيرفر
bun run start
```

افتح المتصفح على: `http://localhost:3050`

---

## هيكل المشروع

```tree
md-to-pdf/
├── server.js          # Hono server — upload, SSE, download
├── convert.js         # Markdown → HTML → PDF (Puppeteer)
├── public/
│   └── index.html     # Web UI
├── uploads/           # ملفات مؤقتة (تُحذف تلقائياً)
├── screenshots/
│   ├── main.png
│   └── success.png
└── package.json
```

---

## API Endpoints

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `POST` | `/convert` | رفع ملف `.md` وبدء التحويل — يرجع `{ jobId }` |
| `GET` | `/stream/:jobId` | SSE stream للـ progress والـ logs |
| `GET` | `/download/:jobId` | تحميل الـ PDF بعد اكتمال التحويل |

---

## تخصيص تنسيق الـ PDF

التنسيق كله في `convert.js` داخل الـ `<style>` block:

| العنصر | التنسيق |
|--------|---------|
| `h1` | خلفية Navy gradient، نص أبيض |
| `h2` | نص Navy + خلفية زرقاء فاتحة + border ذهبي |
| `h3` | نص Navy + border ذهبي رفيع |
| `table > th` | خلفية Navy، نص أبيض |
| `blockquote` | خلفية صفراء فاتحة + border ذهبي |
| Footer | أرقام صفحات + شريط Navy→Gold |

---

## ملاحظات

- الـ jobs تُحذف تلقائياً بعد **10 دقائق** من إنشائها
- حجم الملف المدعوم: أي حجم (لا يوجد حد)
- يتطلب اتصال إنترنت لتحميل خط Cairo من Google Fonts
