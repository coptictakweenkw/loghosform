# تعليمات الإعداد الأولي - المرحلة 1 (طبقة الوسيط والأساسيات)

## 1. رفع هذه الملفات إلى GitHub

ارفع كل الملفات والمجلدات كما هي (بنفس المسارات) إلى مستودعك الفارغ عبر
"Add file → Upload files"، مع الحفاظ على البنية التالية:

```
logos-app/
├── package.json
├── netlify.toml
├── .gitignore
├── SETUP.md
├── public/
│   └── index.html
└── netlify/
    └── functions/
        └── _lib/
            ├── firebaseAdmin.js
            ├── session.js
            └── rateLimiter.js
```

## 2. ربط Netlify بالمستودع (إن لم يكن مربوطًا بعد)

من لوحة Netlify: "Add new site" → "Import an existing project" → اختر
مستودع GitHub الخاص بك. اترك إعدادات البناء كما هي (Netlify سيقرأها
تلقائيًا من ملف `netlify.toml`).

## 3. ضبط متغيرات البيئة (الخطوة الأهم أمنيًا)

من لوحة Netlify: **Site settings → Environment variables → Add a variable**،
أضف كل متغيّر مما يلي:

| اسم المتغيّر | من أين تحصل على قيمته |
|---|---|
| `FIREBASE_PROJECT_ID` | افتح ملف Service Account JSON الذي نزّلته، القيمة في الحقل `project_id` |
| `FIREBASE_CLIENT_EMAIL` | نفس الملف، الحقل `client_email` |
| `FIREBASE_PRIVATE_KEY` | نفس الملف، الحقل `private_key` (انسخه كاملاً بما فيه `-----BEGIN PRIVATE KEY-----` و `-----END PRIVATE KEY-----`) |
| `SESSION_SIGNING_SECRET` | نص عشوائي طويل من عندك (32 حرفًا فأكثر، أي نص عشوائي كافٍ، مثال: افتح أي "مولّد كلمات مرور" واستخدم ناتجه) |

**تذكير:** ملف Service Account JSON نفسه **لا يُرفَع لـ GitHub أبدًا** —
فقط تُنسَخ قيمه الثلاث يدويًا إلى خانات Netlify كما في الجدول أعلاه، ثم
يُحذَف الملف من أي مكان مؤقت وضعته فيه أو يُحفَظ في مكان آمن غير متصل بالإنترنت.

## 4. تفعيل TTL على مجموعة loginAttempts (خطوة إعداد لمرة واحدة)

من لوحة Firebase: **Firestore Database → علامة تبويب "TTL"** (قد تحتاج
لإنشاء المجموعة أولاً بإضافة أول سجل فيها عبر الكود قبل أن تظهر هنا) →
أضف سياسة TTL على الحقل `expireAt` لمجموعة `loginAttempts`. سنذكّرك بهذه
الخطوة مرة أخرى عند وصولنا لبناء أول دالة تكتب فعليًا في هذه المجموعة.

## 5. ماذا بعد؟

بمجرد رفع هذه الملفات وضبط المتغيرات الأربعة، أخبرني، وسننتقل للدالة
الفعلية الأولى: `checkChildPhoneAvailability` و `registerChild`.
