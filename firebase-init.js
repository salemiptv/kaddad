// firebase-init.js

const admin = require('firebase-admin');

// تحقق مما إذا كان التطبيق قد تم تهيئته بالفعل
if (!admin.apps.length) {
  const serviceAccount = require('./path/to/your/serviceAccountKey.json'); // تأكد من وضع المسار الصحيح

  // تهيئة Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kaddad-2-default-rtdb.firebaseio.com"
  });
}

// تهيئة خدمة Firebase Cloud Messaging
const messaging = admin.messaging();

// تصدير messaging لاستخدامه في باقي أجزاء التطبيق
module.exports = messaging;
