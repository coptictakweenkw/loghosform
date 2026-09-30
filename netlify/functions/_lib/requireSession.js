// تُستخدَم في بداية أي دالة تتطلب جلسة (باستثناء changePin نفسها).
// تتحقق من صحة رمز الجلسة، وترفض العملية فورًا إن كان mustChangePin لا يزال
// true -- هذا هو الفرض الفعلي من جهة الخادم المذكور في القسم 2 من المستند،
// لا مجرد توجيه في الواجهة يمكن تجاوزه.

const { verifySessionToken } = require('./session');

/**
 * @param {object} event - كائن الحدث القادم لدالة Netlify
 * @returns {{ id: string, role: 'child'|'teacher'|'admin' }}
 * @throws Error برسالة واضحة عند فشل التحقق أو وجوب تغيير الرمز أولاً
 */
function requireSession(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  let session;
  try {
    session = verifySessionToken(token);
  } catch (e) {
    const err = new Error('جلسة غير صالحة أو منتهية، الرجاء تسجيل الدخول مجددًا.');
    err.statusCode = 401;
    throw err;
  }

  if (session.mustChangePin) {
    const err = new Error('يجب تغيير الرمز السري الافتراضي أولاً قبل المتابعة.');
    err.statusCode = 403;
    throw err;
  }

  return session;
}

module.exports = { requireSession };
