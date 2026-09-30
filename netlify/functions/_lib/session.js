// إصدار والتحقق من رمز الجلسة الموقّع ذاتيًا.
// هذا هو بديلنا الكامل عن Firebase Authentication (القسم 2 من مستند التصميم).
//
// متغيّر البيئة المطلوب:
//   SESSION_SIGNING_SECRET   (نص عشوائي طويل تولّده أنت مرة واحدة، لا تشاركه مع أحد)

const jwt = require('jsonwebtoken');

const SESSION_TTL = '90d'; // الجلسة تبقى صالحة 90 يومًا؛ يمكن تعديلها لاحقًا بسهولة

function getSecret() {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    throw new Error('متغيّر البيئة SESSION_SIGNING_SECRET غير مضبوط في إعدادات Netlify.');
  }
  return secret;
}

/**
 * يُصدر رمز جلسة جديدًا بعد نجاح الدخول.
 * @param {{ id: string, role: 'child' | 'teacher' | 'admin', mustChangePin: boolean }} payload
 */
function issueSessionToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_TTL });
}

/**
 * يتحقق من رمز جلسة ويُعيد بياناته، أو يرمي خطأ إن كان غير صالح/منتهيًا.
 * @param {string} token
 */
function verifySessionToken(token) {
  if (!token) {
    throw new Error('لا يوجد رمز جلسة.');
  }
  return jwt.verify(token, getSecret());
}

module.exports = { issueSessionToken, verifySessionToken };
