// POST { phone, pin } -> { token, childId }
//
// تحقق من تطابق الهاتف والرمز السري، مع حد محاولات فاشلة مزدوج
// (حسب رقم الهاتف نفسه، القسم 2.2). حد الـ IP سيُضاف في خطوة لاحقة منفصلة
// بعد اختبار هذا الجزء الأساسي أولاً، تفاديًا لتعقيد الاختبار الأول.

const bcrypt = require('bcryptjs');
const { getFirestore } = require('./_lib/firebaseAdmin');
const { issueSessionToken } = require('./_lib/session');
const { assertNotLocked, recordFailedLogin, clearFailedAttempts } = require('./_lib/rateLimiter');

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
    const lockKey = `login:phone:${trimmedPhone}`;

    // 1) التحقق أولاً أن هذا الرقم غير مقفل حاليًا بسبب محاولات سابقة فاشلة
    await assertNotLocked(lockKey);

    // 2) البحث عن الطفل صاحب هذا الرقم
    const db = getFirestore();
    const snap = await db.collection('children').where('phone', '==', trimmedPhone).limit(1).get();

    if (snap.empty) {
      await recordFailedLogin(lockKey);
      return { statusCode: 401, body: JSON.stringify({ error: 'رقم الهاتف أو الرمز السري غير صحيح.' }) };
    }

    const childDoc = snap.docs[0];
    const childData = childDoc.data();

    // 3) مقارنة الرمز السري المُدخَل بالنسخة المُشفَّرة المخزّنة
    const pinMatches = await bcrypt.compare(pin, childData.pin);
    if (!pinMatches) {
      await recordFailedLogin(lockKey);
      return { statusCode: 401, body: JSON.stringify({ error: 'رقم الهاتف أو الرمز السري غير صحيح.' }) };
    }

    // 4) نجاح الدخول: تصفير عدّاد المحاولات الفاشلة وإصدار جلسة جديدة
    await clearFailedAttempts(lockKey);
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
