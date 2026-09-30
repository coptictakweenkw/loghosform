// GET/POST { phone } -> { available: boolean }
// تحقق فوري من عدم تكرار الهاتف ضمن مجموعة children فقط (القسم 6.1، 2.1).
// بلا أي حد استدعاء (قرار صريح سابق: البيئة مغلقة وموثوقة، لا حاجة لحماية إضافية هنا).

const { getFirestore } = require('./_lib/firebaseAdmin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { phone } = JSON.parse(event.body || '{}');

    if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'رقم هاتف غير صالح.' }) };
    }

    const db = getFirestore();
    const snap = await db.collection('children').where('phone', '==', phone.trim()).limit(1).get();

    return {
      statusCode: 200,
      body: JSON.stringify({ available: snap.empty }),
    };
  } catch (err) {
    console.error('checkChildPhoneAvailability error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'حدث خطأ غير متوقع، حاول مجددًا.' }) };
  }
};
