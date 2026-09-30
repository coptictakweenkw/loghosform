// تهيئة موحّدة لـ Firebase Admin SDK.
// يُستدعى مرة واحدة، وتُعاد نفس الوصلة (instance) لكل دالة تحتاج الوصول لـ Firestore.
//
// متغيّرات البيئة المطلوبة (تُضاف من لوحة Netlify، لا تُكتب هنا أبدًا):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (القيمة من ملف Service Account JSON، انتبه لعلامات السطر \n)

const admin = require('firebase-admin');

function getFirestore() {
  if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error(
        'متغيّرات بيئة Firebase غير مكتملة. تأكد من ضبط FIREBASE_PROJECT_ID و FIREBASE_CLIENT_EMAIL و FIREBASE_PRIVATE_KEY في إعدادات Netlify.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  return admin.firestore();
}

module.exports = { getFirestore, admin };
