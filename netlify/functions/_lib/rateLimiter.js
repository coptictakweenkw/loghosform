// منطق حد المحاولات الفاشلة (القسم 2.2 من مستند التصميم)، وحد الاستدعاء البسيط
// لدوال الاستعادة بالبريد. كل السجلات تُحفَظ في مجموعة loginAttempts، بمفاتيح
// مميّزة حسب النوع، مع حقل expireAt (TTL) يُنظَّف تلقائيًا بعد يوم واحد.
//
// ملاحظة: يجب تفعيل TTL على حقل expireAt لمجموعة loginAttempts يدويًا
// من لوحة Firebase (Firestore -> علامة التبويب "TTL") -- خطوة إعداد لمرة واحدة.

const { getFirestore, admin } = require('./firebaseAdmin');

const FAILED_LOGIN_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;
const TTL_DAYS = 1;

function nowPlusMinutes(minutes) {
  return admin.firestore.Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);
}

function ttlExpireAt() {
  return admin.firestore.Timestamp.fromMillis(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * يتحقق أن مفتاحًا معيّنًا (هوية أو IP) غير مقفل حاليًا بسبب محاولات فاشلة سابقة.
 * يرمي خطأً واضحًا إن كان لا يزال مقفلاً.
 */
async function assertNotLocked(key) {
  const db = getFirestore();
  const ref = db.collection('loginAttempts').doc(encodeURIComponent(key));
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data();
    if (data.lockedUntil && data.lockedUntil.toMillis() > Date.now()) {
      const remainingMin = Math.ceil((data.lockedUntil.toMillis() - Date.now()) / 60000);
      throw new Error(`تم تجاوز عدد المحاولات المسموح. حاول مجددًا خلال ${remainingMin} دقيقة تقريبًا.`);
    }
  }
}

/**
 * يُسجّل محاولة دخول فاشلة لمفتاح معيّن (مثال: "login:phone:XXXXXXXX" أو "login:ip:1.2.3.4").
 * يُقفَل المفتاح تلقائيًا بعد بلوغ الحد الأقصى للمحاولات.
 */
async function recordFailedLogin(key) {
  const db = getFirestore();
  const ref = db.collection('loginAttempts').doc(encodeURIComponent(key));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().failedCount || 0 : 0;
    const newCount = current + 1;

    const update = {
      key,
      failedCount: newCount,
      expireAt: ttlExpireAt(),
    };

    if (newCount >= FAILED_LOGIN_LIMIT) {
      update.lockedUntil = nowPlusMinutes(LOGIN_LOCK_MINUTES);
      update.failedCount = 0; // إعادة العدّاد بعد القفل
    }

    tx.set(ref, update, { merge: true });
  });
}

/**
 * يُصفّر عدّاد المحاولات الفاشلة لمفتاح معيّن بعد نجاح الدخول.
 */
async function clearFailedAttempts(key) {
  const db = getFirestore();
  const ref = db.collection('loginAttempts').doc(encodeURIComponent(key));
  await ref.set({ key, failedCount: 0, lockedUntil: null, expireAt: ttlExpireAt() }, { merge: true });
}

/**
 * حد استدعاء بسيط (Throttle) مستقل عن مفهوم "الفشل" -- يُستخدَم فقط لدوال
 * الاستعادة (مثل requestPinReset). يرمي خطأً إن تجاوز عدد الاستدعاءات المسموح
 * خلال النافذة الزمنية المحددة.
 * مفتاح مثال: "reset-throttle:email:xxx@example.com"
 */
async function assertUnderThrottle(key, maxCalls, windowMinutes) {
  const db = getFirestore();
  const ref = db.collection('loginAttempts').doc(encodeURIComponent(key));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const windowStart = data && data.windowStart ? data.windowStart.toMillis() : 0;
    const isSameWindow = Date.now() - windowStart < windowMinutes * 60 * 1000;
    const currentCount = isSameWindow ? data.callCount || 0 : 0;

    if (currentCount >= maxCalls) {
      throw new Error('تم تجاوز عدد الطلبات المسموح خلال هذه الفترة. حاول لاحقًا.');
    }

    tx.set(
      ref,
      {
        key,
        callCount: currentCount + 1,
        windowStart: isSameWindow ? data.windowStart : admin.firestore.Timestamp.now(),
        expireAt: ttlExpireAt(),
      },
      { merge: true }
    );
  });
}

module.exports = {
  assertNotLocked,
  recordFailedLogin,
  clearFailedAttempts,
  assertUnderThrottle,
};
