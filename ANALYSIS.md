# تقرير تحليل شامل — MD-to-PDF

> **التاريخ:** 2026-04-08
> **الفرع:** v1.1.0-cline
> **Stack:** Bun + Hono + SQLite + Puppeteer-core + Vanilla JS SPA

---

## نظرة عامة

| البند | التفاصيل |
|-------|---------|
| المشروع | محول Markdown → PDF مع نظام مصادقة وحفظ ملفات |
| Backend | Bun + Hono + SQLite (bun:sqlite) |
| Frontend | Vanilla JS SPA (router + i18n + pages) |
| PDF Engine | puppeteer-core (auto-detect Chrome/Edge) |
| اللغات | عربي + إنجليزي (i18n) |
| عدد ملفات السورس | ~20 ملف |

---

## التقييم العام

| المحور | التقييم | ملاحظات |
|--------|---------|---------|
| البنية (Architecture) | 4/10 | خلط بين SPA fragments وصفحات كاملة |
| جودة الكود (Code Quality) | 4/10 | دوال مكررة، كود ميت، عدم تناسق |
| الأمان (Security) | 3/10 | debug route مكشوف، stack traces مسربة، لا CSRF |
| الـ UI/UX | 6/10 | تصميم جميل لكن الصفحات مكسورة وظيفياً |
| الأداء | 7/10 | مقبول — SQLite + Bun سريعين |
| الـ i18n | 4/10 | مفاتيح غير متسقة، نصوص hardcoded بالعربي |

---

## 🔴 مشاكل حرجة — يجب إصلاحها فوراً

### 1. صفحات SPA هي HTML كامل وليست fragments

**الملفات:** `files.html`, `login.html`, `register.html`

هذه الصفحات تحتوي على `<html>`, `<head>`, `<body>` كاملة، لكنها تُحمّل عبر `router.loadPage()` الذي يضعها داخل `#app` div:

```js
// router.js:51 — يحقن HTML كامل داخل div
app.innerHTML = html;
```

**النتيجة:**
- HTML غير صالح (`<html>` داخل `<div>`)
- تحميل مكرر لـ CSS و JS (router.js, i18n.js, api.js, app.js) كل مرة
- `DOMContentLoaded` listeners داخل الصفحات لن تُطلق لأن DOM محمّل بالفعل
- إعادة تهيئة `router` و `i18n` مع كل تنقل

**ملاحظة:** `convert.html` هو الوحيد المكتوب بشكل صحيح كـ fragment.

---

### 2. SSE Event Handling غير متوافق

**الملف:** `convert.html:248-256`

الفرونت يتوقع:
```js
if (data.type === 'progress') { ... }
if (data.type === 'complete') { ... }
```

لكن السيرفر يرسل:
```js
{ percent: 85, message: "جاري إنشاء الـ PDF..." }  // لا يوجد type
{ done: true }                                        // لا يوجد type: 'complete'
```

**النتيجة:** التحويل يبدو وكأنه لا يتقدم — الـ progress bar لا يتحرك والـ terminal لا يُحدّث.

---

### 3. Login لا يعمل — API mismatch

**الملف:** `login.html:278-283`

```js
const response = await api.post('/api/auth/login', {
  Email: email,      // ← PascalCase
  Password: password  // ← PascalCase
});
if (response.Success) {  // ← يتوقع Success
  localStorage.setItem('token', response.Data.Token);  // ← يتوقع Data.Token
```

لكن السيرفر يتوقع:
```js
const { email, password } = await c.req.json();  // ← camelCase
// ويرجع:
return c.json({ user });  // ← لا يوجد Success أو Data.Token
```

**النتيجة:** تسجيل الدخول فاشل دائماً.

---

### 4. `/debug` route مكشوف في Production

**الملف:** `server.js:40-48`

```js
app.get("/debug", (c) => {
  const sessionToken = c.req.cookie("session");
  const user = sessionToken ? auth.verifySession(sessionToken) : null;
  return c.json({ cookie: sessionToken || "none", user: user || null });
});
```

يكشف session tokens وبيانات المستخدمين لأي شخص.

---

### 5. Stack traces مسربة في Error Handler

**الملف:** `server.js:33-36`

```js
app.onError((err, c) => {
  return c.json({ error: err.message, details: err.stack }, 500);
  //                                    ^^^^^^^^^^^^^^^^ خطير
});
```

يكشف مسارات الملفات وتفاصيل الكود الداخلي.

---

### 6. `resultActions` div فيه CSS متضارب

**الملف:** `convert.html:70`

```html
<div class="result-actions" id="resultActions" style="display: none; margin-top: 20px; display: flex;">
```

`display: flex` يتغلب على `display: none` — الأزرار ظاهرة دائماً.

---

### 7. `files.html` — API calls غير متوافقة

**الملف:** `files.html:114-118`

```js
const response = await api.get('/files');  // ← مسار خاطئ (يجب /api/files)
if (response.success) {                     // ← يتوقع success
  this.files = response.data.files || [];   // ← يتوقع data.files
```

السيرفر يرجع:
```js
return c.json({ files: userFiles });  // ← لا يوجد success أو data
```

وأيضاً:
```js
await api.delete(`/files/${fileId}`);  // ← api.delete غير موجودة، الصحيح api.del
```

---

## 🟡 مشاكل مهمة

### 8. دوال مكررة في app.js

**الملف:** `app.js`

- `initSidebar()` معرّفة مرتين (سطر 16 وسطر 154) — **نسخة مطابقة**
- `toggleSidebar()` معرّفة مرتين (سطر 40 وسطر 178) — **نسخة مطابقة**

---

### 9. كود ميت في app.js

**الملف:** `app.js:106-152`

الدوال التالية معرّفة لكن **لا تُستدعى أبداً**:
- `renderConvertPage()`
- `renderFilesPage()`
- `renderLoginPage()`
- `renderRegisterPage()`
- `render404Page()`

الـ router يستخدم `router.loadPage()` مباشرة.

---

### 10. CSS مكسور

**الملف:** `main.css:366`

```css
@media (max-width: 768px) {
  /* ... */
}
  transition: var(--transition);  /* ← خارج أي selector — مكسور */
}
```

وأيضاً definitions مكررة:
- `.btn` — سطر 308 وسطر 417
- `.btn-primary` — سطر 317 وسطر 429
- `.btn-sm` — سطر 337 وسطر 470
- `.user-name` — سطر 349 وسطر 386

---

### 11. لا يوجد تنظيف للـ Sessions المنتهية

**الملف:** `auth.js`

الـ sessions المنتهية تتراكم في قاعدة البيانات إلى الأبد. لا يوجد:
- `setInterval` لحذف expired sessions
- PRAGMA foreign_keys = ON (FK constraints لا تُطبّق)

---

### 12. `files.js` — `unlink` synchronous خاطئ

**الملف:** `files.js:2`

```js
import { existsSync, mkdirSync, unlink, copyFileSync, statSync } from "node:fs";
```

`unlink` من `node:fs` تحتاج callback. المستخدم في السطر 91:
```js
unlink(file.pdf_path);  // ← بدون callback — سيرمي warning أو يفشل
```

الصحيح: `import { unlink } from "node:fs/promises"` مع `await`.

---

### 13. Polling fallback لـ endpoint غير موجود

**الملف:** `convert.html:279`

```js
const res = await fetch(`/status/${jobId}`);  // ← هذا الـ route غير موجود في server.js
```

---

### 14. لا CSRF protection

المصادقة تعتمد على cookies (`httpOnly`, `sameSite: strict`). `sameSite: strict` يوفر حماية جزئية، لكن لا يوجد CSRF token حقيقي.

---

### 15. `register.html` — روابط تنقل خاطئة

**الملف:** `register.html:237-238`

```html
<a href="/pages/login.html">تسجيل دخول</a>
```

يجب أن يكون `/login` (SPA route) وليس المسار الفعلي للملف.

وبعد التسجيل الناجح:
```js
window.location.href = "/pages/login.html";  // ← خاطئ
```

---

### 16. i18n — مفاتيح غير متسقة

| مكان الاستخدام | المفتاح المستخدم | موجود في ar.json؟ |
|----------------|-----------------|-------------------|
| `login.html` | `auth.loginSubtitle` | لا |
| `login.html` | `auth.loginBtn` | لا |
| `login.html` | `auth.emailPlaceholder` | لا |
| `login.html` | `errors.emailRequired` | لا |
| `login.html` | `errors.invalidEmail` | لا |
| `login.html` | `errors.passwordRequired` | لا |
| `login.html` | `errors.loginFailed` | لا |
| `login.html` | `errors.networkError` | لا |
| `login.html` | `auth.noAccount` | لا |
| `login.html` | `auth.registerLink` | لا |
| `register.html` | `auth.namePlaceholder` | لا |
| `register.html` | `auth.confirmPasswordPlaceholder` | لا |
| `register.html` | `auth.passwordMismatch` | لا |
| `register.html` | `auth.haveAccount` | لا |
| `app.js` | `success.loggedOut` | لا (موجود في en.json فقط كـ `success.logout`) |

---

### 17. رسائل خطأ hardcoded بالعربي في السيرفر

**الملفات:** `server.js`, `convert.js`

```js
// server.js
return c.json({ error: "فشل في قراءة البيانات المرسلة" }, 400);
return c.json({ error: "يجب أن يكون الملف بصيغة .md" }, 400);

// convert.js onLog callbacks
onLog(10, "جاري تحليل الـ Markdown...");
```

يجب أن تكون مفاتيح ترجمة والفرونت يترجمها.

---

## 🟢 نقاط قوة

1. **Backend architecture سليم** — `db.js`, `auth.js`, `files.js` مفصولين بشكل جيد
2. **SQLite + WAL mode** — أداء ممتاز لهذا الحجم
3. **Password hashing** — يستخدم `Bun.password.hash()` (bcrypt مدمج)
4. **Rate limiting** — موجود على login attempts
5. **File ownership validation** — كل endpoint يتحقق من ملكية الملف
6. **Storage quotas** — حدود ملفات (20) وحجم (100MB) لكل مستخدم
7. **Error handling في convert.js** — `try/finally` يضمن `browser.close()`
8. **Chrome auto-detect** — يعمل على Windows/Linux/macOS بدون تهيئة
9. **Cookie security** — `httpOnly`, `sameSite: strict`
10. **Job cleanup** — ملفات مؤقتة تُنظف تلقائياً

---

## خارطة الإصلاح

### 🔴 عاجل (يمنع التطبيق من العمل)

| # | المشكلة | الملف | الحل |
|---|---------|-------|------|
| 1 | صفحات SPA كاملة | `files.html`, `login.html`, `register.html` | إعادة كتابتها كـ fragments (مثل `convert.html`) |
| 2 | SSE mismatch | `convert.html` | تعديل event handling ليطابق format السيرفر |
| 3 | Login API mismatch | `login.html` | إصلاح field names + response handling |
| 4 | `/debug` مكشوف | `server.js` | حذف الـ route أو حمايته |
| 5 | Stack traces مسربة | `server.js` | حذف `err.stack` من response |
| 6 | CSS متضارب في resultActions | `convert.html` | حذف `display: flex` من inline style |
| 7 | Files API mismatch | `files.html` | إصلاح المسارات + response handling |

### 🟡 مهم (يسبب مشاكل للمستخدمين)

| # | المشكلة | الملف | الحل |
|---|---------|-------|------|
| 8 | دوال مكررة | `app.js` | حذف النسخ المكررة |
| 9 | كود ميت | `app.js` | حذف الدوال غير المستخدمة |
| 10 | CSS مكسور | `main.css` | إصلاح orphaned property + حذف duplicates |
| 11 | Session cleanup مفقود | `auth.js` | إضافة `setInterval` لحذف expired sessions |
| 12 | `unlink` sync | `files.js` | استخدام `fs/promises` مع `await` |
| 13 | Polling endpoint مفقود | `convert.html` | حذف `pollForResult` أو إضافة `/status/:jobId` |
| 14 | روابط خاطئة في register | `register.html` | استخدام SPA routes |
| 15 | i18n keys ناقصة | `ar.json`, `en.json` | إضافة كل المفاتيح المستخدمة |
| 16 | رسائل hardcoded | `server.js`, `convert.js` | تحويلها لمفاتيح ترجمة |

### 🟢 تحسينات مستقبلية

| # | التحسين | الملف |
|---|---------|-------|
| 17 | CSRF token | `auth.js`, `server.js` |
| 18 | `Secure` flag على cookies في production | `auth.js` |
| 19 | `PRAGMA foreign_keys = ON` | `db.js` |
| 20 | Session refresh عند الاستخدام | `auth.js` |

---

## الخلاصة

المشروع فيه **أساس backend قوي** (auth, files, db, convert كلهم مكتوبين بشكل سليم)، لكن الـ **frontend فيه مشاكل بنيوية كبيرة** بسبب خلط بين صفحات HTML كاملة و SPA fragments.

**أول حاجة لازم تتعمل:** إعادة كتابة `login.html`, `register.html`, `files.html` كـ fragments (زي `convert.html`) بدون `<html>/<head>/<body>` وبدون إعادة تحميل scripts. بعدها إصلاح الـ API mismatches اللي بتخلي Login و Files و SSE مش شغالين.

بعد إصلاح المشاكل الحرجة، التطبيق هيكون functional وجاهز للاستخدام.
