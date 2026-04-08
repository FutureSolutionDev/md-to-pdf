# MD → PDF Converter

تحويل ملفات Markdown إلى PDF احترافي مع دعم كامل للعربية واتجاه RTL.

---

## Screenshots

![الواجهة الرئيسية](screenshots/main.png)

![بعد التحويل](screenshots/success.png)

---

# Demo

[https://md.futuresolutionsdev.com](https://md.futuresolutionsdev.com/)

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

مهم جدا اذا كنت ستقوم برفعه علي استضافة يجب تثبيت `chromium-browser` او `chromium`

### تثبيت chromium-browser Or chromium

#### For Debian/Ubuntu based systems

```bash
sudo apt update
sudo apt install chromium-browser
# Or New If Not Working 
sudo snap install chromium
# Test 
which chromium
chromium --version
```

#### For CentOS/RHEL based systems

```bash
sudo yum update
sudo yum install chromium
# Test 
which chromium
chromium --version
```

#### For Fedora based systems

```bash
sudo dnf update
sudo dnf install chromium
# Test 
which chromium
chromium --version
```

#### For Arch Linux based systems

```bash
sudo pacman -Syu
sudo pacman -S chromium
# Test 
which chromium
chromium --version
```

#### For openSUSE based systems

```bash
sudo zypper update
sudo zypper install chromium
# Test 
which chromium
chromium --version
```

#### For Alpine Linux based systems

```bash
sudo apk update
sudo apk add chromium
# Test 
which chromium
chromium --version
```

```bash
# تثبيت الـ dependencies
bun install

# تشغيل السيرفر
bun run start
# Run With PM2
pm2 start ecosystem.config.js

```

افتح المتصفح على: `http://localhost:3050` او `https://example.com`

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
├── ecosystem.config.js  # PM2 config
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
