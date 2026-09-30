// POST headers: { Authorization: "Bearer <token>" }, body: { currentPin, newPin } -> { token }
//
// تعمل لكل الفئات الثلاث (طفل/معلم/مسؤول) بحسب الدور المخزَّن داخل رمز الجلسة.
// تتطلب إدخال الرمز الحالي كتأكيد إضافي قبل قبول الجديد (تحصين ضد استخدام
// جهاز مشترك تُرِك عليه جلسة نشطة، القسم 2 من مستند التصميم).
// بعد النجاح: mustChangePin تُضبَط دائمًا إلى false، ويُصدَر رمز جلسة جديد
// يعكس هذه الحالة المُحدَّثة.

const bcrypt = require('bcryptjs');
const { getFirestore } = require('./_lib/firebaseAdmin');
const { verifySessionToken, issueSessionToken } = require('./_lib/session');

const PIN_REGEX = /^\d{4}$/;

function collectionForRole(role) {
  // الأطفال في مجموعة children، أما المعلمون والمسؤول العام ففي teachers
  return role === 'child' ? 'children' : 'teachers';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    let session;
    try {
      session = verifySessionToken(token);
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ error: 'جلسة غير صالحة أو منتهية، الرجاء تسجيل الدخول مجددًا.' }) };
    }

    const { currentPin, newPin } = JSON.parse(event.body || '{}');

    if (!currentPin || !newPin) {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرجاء إدخال الرمز الحالي والرمز الجديد.' }) };
    }
    if (!PIN_REGEX.test(newPin)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرمز الجديد يجب أن يتكوّن من 4 أرقام بالضبط.' }) };
    }
    if (currentPin === newPin) {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرمز الجديد يجب أن يختلف عن الرمز الحالي.' }) };
    }

    const db = getFirestore();
    const collectionName = collectionForRole(session.role);
    const docRef = db.collection(collectionName).doc(session.id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'الحساب غير موجود.' }) };
    }

    const data = snap.data();

    // --- التحقق من الرمز الحالي كتأكيد إلزامي ---
    const currentMatches = await bcrypt.compare(currentPin, data.pin);
    if (!currentMatches) {
      return { statusCode: 401, body: JSON.stringify({ error: 'الرمز الحالي غير صحيح.' }) };
    }

    const newHashedPin = await bcrypt.hash(newPin, 10);
    await docRef.update({ pin: newHashedPin, mustChangePin: false });

    // إصدار جلسة جديدة تعكس mustChangePin: false، ليُحدَّث المتصفح فورًا
    const newToken = issueSessionToken({ id: session.id, role: session.role, mustChangePin: false });

    return { statusCode: 200, body: JSON.stringify({ token: newToken }) };
  } catch (err) {
    console.error('changePin error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'حدث خطأ غير متوقع، حاول مجددًا.' }) };
  }
};
