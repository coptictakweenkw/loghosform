// POST { fullName, phone, pin, classId } -> { token, childId }
//
// إنشاء حساب طفل جديد داخل معاملة ذرية (Transaction) تجمع بين التحقق النهائي
// من عدم تكرار الهاتف والتحقق أن الفصل المختار "active"، وكتابة المستند في
// خطوة واحدة غير قابلة للتجزئة (القسم 6.1، 2.1) -- يمنع تسابق تسجيلين بنفس
// الرقم في اللحظة نفسها. عند نجاح التسجيل، يُنشَأ أول سجل classHistory
// بتاريخ التسجيل نفسه (كما تم الاتفاق عليه).

const bcrypt = require('bcryptjs');
const { getFirestore, admin } = require('./_lib/firebaseAdmin');
const { issueSessionToken } = require('./_lib/session');

const PIN_REGEX = /^\d{4}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { fullName, phone, pin, classId } = JSON.parse(event.body || '{}');

    // --- تحقق أولي من صحة المدخلات قبل أي عملية على قاعدة البيانات ---
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرجاء إدخال الاسم الثلاثي كاملاً.' }) };
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'رقم هاتف غير صالح.' }) };
    }
    if (!pin || !PIN_REGEX.test(pin)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرمز السري يجب أن يتكوّن من 4 أرقام بالضبط.' }) };
    }
    if (!classId || typeof classId !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'الرجاء اختيار الفصل.' }) };
    }

    const trimmedPhone = phone.trim();
    const hashedPin = await bcrypt.hash(pin, 10);

    const db = getFirestore();
    const classRef = db.collection('classes').doc(classId);
    const newChildRef = db.collection('children').doc();

    await db.runTransaction(async (tx) => {
      // 1) التحقق أن الفصل المختار موجود ومفعَّل فعليًا (وليس فقط ما تعرضه الواجهة)
      const classSnap = await tx.get(classRef);
      if (!classSnap.exists || classSnap.data().active !== true) {
        throw new Error('الفصل المختار غير متاح حاليًا. الرجاء اختيار فصل آخر.');
      }

      // 2) التحقق النهائي (الذرّي) من عدم تكرار رقم الهاتف
      const phoneQuery = db.collection('children').where('phone', '==', trimmedPhone).limit(1);
      const phoneSnap = await tx.get(phoneQuery);
      if (!phoneSnap.empty) {
        throw new Error('رقم الهاتف هذا مُسجَّل بالفعل. جرّب رقمًا آخر.');
      }

      // 3) الكتابة الفعلية لحساب الطفل الجديد
      const now = admin.firestore.Timestamp.now();
      tx.set(newChildRef, {
        childId: newChildRef.id,
        fullName: fullName.trim(),
        phone: trimmedPhone,
        pin: hashedPin,
        currentClassId: classId,
        classHistory: [{ classId, fromDate: now, toDate: null }],
        createdAt: now,
      });
    });

    const token = issueSessionToken({ id: newChildRef.id, role: 'child', mustChangePin: false });

    return {
      statusCode: 201,
      body: JSON.stringify({ token, childId: newChildRef.id }),
    };
  } catch (err) {
    console.error('registerChild error:', err);
    const message = err.message && err.message.length < 200 ? err.message : 'تعذّر إنشاء الحساب، حاول مجددًا.';
    return { statusCode: 409, body: JSON.stringify({ error: message }) };
  }
};
