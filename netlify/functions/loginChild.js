// POST { phone, pin } -> { token, childId }
//
// تحقق من تطابق الهاتف والرمز السري، مع حد محاولات فاشلة مزدوج تمامًا
// (حسب رقم الهاتف نفسه + حسب عنوان IP، القسم 2.2) — كلا القيدين مستقل
// عن الآخر، ويكفي أن يكون أحدهما مقفلاً لرفض المحاولة.

const bcrypt = require('bcryptjs');
const { getFirestore } = require('./_lib/firebaseAdmin');
const { issueSessionToken } = require('./_lib/session');
const { assertNotLocked, recordFailedLogin, clearFailedAttempts } = require('./_lib/rateLimiter');

function getClientIp(event) {
  const headers = event.headers || {};
  return (
    headers['x-nf-client-connection-ip'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { phone, pin } = JSON.parse(event.body || '{}');

    if (!phone || !pin) {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرجاء إدخال الهاتف والرمز السري.' }) };
    }

    const trimmedPhone = phone.trim();
    const phoneLockKey = `login:phone:${trimmedPhone}`;
    const ipLockKey = `login:ip:${getClientIp(event)}`;

    // 1) التحقق أولاً أن هذا الرقم وهذا العنوان (IP) غير مقفلين حاليًا
    await assertNotLocked(phoneLockKey);
    await assertNotLocked(ipLockKey);

    // 2) البحث عن الطفل صاحب هذا الرقم
    const db = getFirestore();
    const snap = await db.collection('children').where('phone', '==', trimmedPhone).limit(1).get();

    if (snap.empty) {
      // نُسجّل الفشل على كلا المفتاحين معًا (الهوية والـ IP) في كل مرة
      await Promise.all([recordFailedLogin(phoneLockKey), recordFailedLogin(ipLockKey)]);
      return { statusCode: 401, body: JSON.stringify({ error: 'رقم الهاتف أو الرمز السري غير صحيح.' }) };
    }

    const childDoc = snap.docs[0];
    const childData = childDoc.data();

    // 3) مقارنة الرمز السري المُدخَل بالنسخة المُشفَّرة المخزّنة
    const pinMatches = await bcrypt.compare(pin, childData.pin);
    if (!pinMatches) {
      await Promise.all([recordFailedLogin(phoneLockKey), recordFailedLogin(ipLockKey)]);
      return { statusCode: 401, body: JSON.stringify({ error: 'رقم الهاتف أو الرمز السري غير صحيح.' }) };
    }

    // 4) نجاح الدخول: تصفير عدّاد المحاولات الفاشلة على كلا المفتاحين، وإصدار جلسة جديدة
    await Promise.all([clearFailedAttempts(phoneLockKey), clearFailedAttempts(ipLockKey)]);
    const token = issueSessionToken({ id: childDoc.id, role: 'child', mustChangePin: false });

    return {
      statusCode: 200,
      body: JSON.stringify({ token, childId: childDoc.id, fullName: childData.fullName }),
    };
  } catch (err) {
    console.error('loginChild error:', err);
    // رسالة القفل تُعاد كما هي (واضحة ومفيدة للمستخدم)، أي خطأ آخر يُعاد بصيغة عامة
    const isLockMessage = err.message && err.message.includes('تجاوز عدد المحاولات');
    return {
      statusCode: isLockMessage ? 429 : 500,
      body: JSON.stringify({ error: isLockMessage ? err.message : 'حدث خطأ غير متوقع، حاول مجددًا.' }),
    };
  }
};
