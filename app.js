require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const session = require('express-session');
const { getFirestore, collection, query, where, getDocs } = require('firebase-admin/firestore');
const cors = require('cors');
const bcrypt = require('bcrypt');  // تأكد من تثبيت bcrypt لتشفير كلمات المرور
const stripe = require('stripe')('sk_test_4eC39HqLyjWDarjtT1zdp7dc'); // استخدام المفتاح الخاص بالاختبار
const functions = require("firebase-functions");





// تهيئة Firebase Admin SDK باستخدام بيانات الخدمة
const serviceAccount = require('./config/kaddad-2-firebase-adminsdk-wur0x-0d64532cef.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'kaddad-2', // تأكد من وضع معرّف المشروع الصحيح
});

// تعريف قاعدة البيانات Firestore
const db = admin.firestore();

// إعداد Express
const app = express();

// إعداد المسارات للملفات الثابتة مثل HTML وCSS وJS
app.use(express.static(path.join(__dirname, 'public')));

// استخدام bodyParser لمعالجة البيانات المرسلة من العميل
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// إعداد الجلسات
// إعداد الجلسات
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // تفعيل secure في بيئة الإنتاج فقط
    httpOnly: true,
    sameSite: 'strict',
  }
}));



// إعداد multer لتخزين الملفات المرفوعة
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');  // حدد مجلد رفع الملفات
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));  // استخدام الوقت الحالي كاسم فريد للملف
  }
});

const upload = multer({ storage: storage });

// إعداد nodemailer لإرسال البريد الإلكتروني
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// هذه دالة لتشفير كلمة المرور الموجودة في قاعدة البيانات
async function encryptPasswords() {
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();

    // استرجاع وتشفير كل كلمة مرور
    for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        
        // إذا كانت كلمة المرور نصية فقط
        if (user.password && !user.password.startsWith('$2a$')) {  // إذا لم تكن مشفرة باستخدام bcrypt
            const hashedPassword = await bcrypt.hash(user.password, 10);

            // تحديث كلمة المرور المشفرة في قاعدة البيانات
            await usersRef.doc(doc.id).update({
                password: hashedPassword
            });

            console.log(`تم تشفير كلمة المرور للمستخدم ${user.fullName}`);
        }
    }
}

// استدعاء الدالة لتشفير كلمات المرور في قاعدة البيانات
encryptPasswords().then(() => {
    console.log("تم تشفير كافة كلمات المرور.");
}).catch(err => {
    console.error("حدث خطأ أثناء تشفير كلمات المرور:", err);
});


// نقطة النهاية لإضافة الضيف
app.post('/guests-register', (req, res) => {
    const { fullName, phone } = req.body;
    
    // تحقق من وجود البيانات
    if (!fullName || !phone) {
        return res.status(400).json({ success: false, message: 'الاسم الكامل ورقم الهاتف مطلوبان' });
    }

    const currentTime = admin.firestore.FieldValue.serverTimestamp();
    
    // حساب وقت الحذف (بعد يوم واحد)
    const deleteAt = new Date();
    deleteAt.setDate(deleteAt.getDate() + 1);  // إضافة يوم

    // إضافة الضيف إلى قاعدة البيانات
    db.collection('guests').add({
        fullName,
        phone,
        createdAt: currentTime,
        deleteAt: deleteAt // تحديد وقت الحذف
    })
    .then(docRef => {
        // جدولة الحذف بعد فترة معينة
        scheduleGuestDeletion(docRef.id, deleteAt);

        res.json({ success: true, message: 'تم التسجيل بنجاح', guestId: docRef.id });
    })
    .catch(error => {
        console.error('خطأ أثناء إضافة الضيف:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في النظام' });
    });
});

// دالة لجدولة الحذف التلقائي بعد فترة معينة
function scheduleGuestDeletion(guestId, deleteAt) {
    const delay = deleteAt.getTime() - Date.now(); // الوقت المتبقي حتى الحذف

    // استخدام setTimeout لتأخير عملية الحذف
    setTimeout(async () => {
        try {
            // حذف الضيف من قاعدة البيانات بعد الوقت المحدد
            await db.collection('guests').doc(guestId).delete();
            console.log(`تم حذف الضيف ${guestId} تلقائيًا بعد مرور الوقت المحدد.`);
        } catch (error) {
            console.error('خطأ أثناء حذف الضيف:', error);
        }
    }, delay);
}


// مسار للتعامل مع رفع الصور والمعلومات
app.post('/register', upload.fields([
  { name: 'carLicenseImage', maxCount: 1 },
  { name: 'carLicenseImageBack', maxCount: 1 },
  { name: 'driverLicenseImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { fullName, nationalId, carNumber, code, carRegistrationNumber, carType, carColor, email, phone } = req.body;

    if (!fullName || !nationalId || !carNumber || !code || !carRegistrationNumber || !carType || !carColor || !email || !phone) {
      return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة." });
    }

    if (!req.files['carLicenseImage'] || !req.files['carLicenseImageBack'] || !req.files['driverLicenseImage']) {
      return res.status(400).json({ success: false, message: "جميع الصور مطلوبة." });
    }

    const newUser = {
      fullName,
      phone,
      nationalId,
      carNumber,
      code,
      carRegistrationNumber,
      carType,
      carColor,
      email,
      carLicenseImage: req.files['carLicenseImage'][0].filename,
      carLicenseImageBack: req.files['carLicenseImageBack'][0].filename,
      driverLicenseImage: req.files['driverLicenseImage'][0].filename,
      isActive: false,  // المستخدم غير مفعل في البداية
    };

    await addUser(newUser);
    res.json({ success: true, message: "تم التسجيل بنجاح، بانتظار الموافقة." });
  } catch (error) {
    console.error('خطأ أثناء تسجيل المستخدم:', error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء التسجيل." });
  }
});

// إضافة المستخدم إلى قاعدة البيانات
async function addUser(newUser) {
  const usersRef = db.collection('users');

  try {
    const userRef = usersRef.doc(newUser.phone);
    await userRef.set(newUser);

    // إشعار المسؤول
    notifyAdmin(newUser);
  } catch (error) {
    console.error('خطأ في إدخال المستخدم:', error);
  }
}

// إشعار المسؤول بطلب تسجيل مستخدم جديد
function notifyAdmin(newUser) {
  const acceptLink = `http://localhost:3000/approve-user/${newUser.phone}`;
  const rejectLink = `http://localhost:3000/reject-user/${newUser.phone}`;

  const htmlContent = `
    <h2>طلب تسجيل مستخدم جديد</h2>
    <p>تفاصيل المستخدم:</p>
    <ul>
      <li><strong>الاسم الكامل:</strong> ${newUser.fullName}</li>
      <li><strong>البريد الإلكتروني:</strong> ${newUser.email}</li>
      <li><strong>رقم الهاتف:</strong> ${newUser.phone}</li>
    </ul>
    <p>الرجاء اتخاذ الإجراء المناسب:</p>
    <a href="${acceptLink}" style="padding: 10px; background-color: green; color: white; text-decoration: none;">قبول</a>
    <a href="${rejectLink}" style="padding: 10px; background-color: red; color: white; text-decoration: none;">رفض</a>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: 'طلب تسجيل مستخدم جديد',
    html: htmlContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('خطأ في إرسال البريد الإلكتروني:', error);
    } else {
      console.log('تم إرسال البريد الإلكتروني بنجاح:', info.response);
    }
  });
}

// الموافقة على المستخدم وإرسال رابط الدفع
app.get('/approve-user/:phone', async (req, res) => {
    const userPhone = req.params.phone;  // استخدام رقم الهاتف كمفتاح في الرابط

    // استرجاع بيانات المستخدم من قاعدة البيانات باستخدام رقم الهاتف
    const userRef = db.collection('users').doc(userPhone);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
    }

    const newUser = userDoc.data();

    // التأكد من وجود البريد الإلكتروني للمستخدم
    const userEmail = newUser.email;
    if (!userEmail) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني غير موجود." });
    }

    const paymentLink = `http://localhost:3000/payment/${userPhone}`;

    // إعداد البريد الإلكتروني
    const mailOptions = {
        from: process.env.EMAIL_USER,  // المرسل
        to: userEmail,  // المستقبل - تأكد من أن البريد الإلكتروني صحيح
        subject: 'تفعيل الحساب - رابط الدفع',
        html: `<p>يرجى الدفع باستخدام الرابط التالي لتفعيل حسابك:</p><a href="${paymentLink}">دفع الآن</a>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('خطأ في إرسال رابط الدفع:', error);
            return res.status(500).json({ success: false, message: 'حدث خطأ أثناء إرسال البريد الإلكتروني.' });
        } else {
            console.log('تم إرسال رابط الدفع:', info.response);
            return res.status(200).json({ success: true, message: 'تم إرسال رابط الدفع إلى البريد الإلكتروني.' });
        }
    });
});

// مسار GET لعرض صفحة الدفع بناءً على رقم الهاتف
// مسار GET لعرض صفحة الدفع بناءً على رقم الهاتف
app.get('/payment/:phone', async (req, res) => {
    const userPhone = req.params.phone;

    // استرجاع بيانات المستخدم من قاعدة البيانات باستخدام رقم الهاتف
    const userRef = db.collection('users').doc(userPhone);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
    }

    const userData = userDoc.data();  // تخزين بيانات المستخدم في المتغير userData

    // التأكد من أن المتغير يحتوي على بيانات المستخدم
    console.log(userData);  // استخدم هذا السطر لتصحيح الأخطاء في حالة لم يتم استرجاع البيانات بشكل صحيح

    // عرض نموذج الدفع للمستخدم باستخدام البيانات المسترجعة
    res.send(`
        <h1>مرحبا ${userData.fullName}!</h1>
        <p>يرجى إدخال المبلغ المطلوب دفعه لإتمام عملية تفعيل الحساب.</p>
        <form action="/payment" method="POST">
            <input type="hidden" name="phone" value="${userPhone}">
            <input type="number" name="amount" placeholder="المبلغ" required>
            <button type="submit">إتمام الدفع</button>
        </form>
    `);
});

// مسار POST لمعالجة الدفع باستخدام Stripe
const crypto = require('crypto');  // لتوليد كلمة مرور عشوائية

// دالة لتوليد كلمة مرور عشوائية
function generateRandomPassword() {
    return crypto.randomBytes(8).toString('hex'); // توليد كلمة مرور مكونة من 16 حرفًا (8 بايت)
}
// مسار الدفع باستخدام Stripe
app.post('/payment', async (req, res) => {
    const { payment_method, amount, phone } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,  // المبلغ بالـ سنتات
            currency: 'usd',
            payment_method: payment_method,
            automatic_payment_methods: { enabled: true },
        });

        // إذا تم الدفع بنجاح، توليد كلمة مرور عشوائية
        const randomPassword = generateRandomPassword();

        // استرجاع بيانات المستخدم من قاعدة البيانات باستخدام رقم الهاتف
        const userRef = db.collection('users').doc(phone);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
        }

        const newUser = userDoc.data();
        const userEmail = newUser.email;

        // التأكد من وجود البريد الإلكتروني
        if (!userEmail) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير موجود." });
        }

        // إرسال البريد الإلكتروني للعميل
        const mailOptions = {
            from: process.env.EMAIL_USER,  // المرسل
            to: userEmail,  // البريد الإلكتروني للمستقبل
            subject: 'تم الدفع بنجاح وتفعيل الحساب',
            html: `
                <h2>تم الدفع بنجاح</h2>
                <p>تمت عملية الدفع بنجاح، وفيما يلي تفاصيل حسابك:</p>
                <ul>
                    <li><strong>اسم المستخدم:</strong> ${phone}</li>
                    <li><strong>كلمة المرور:</strong> ${randomPassword}</li>
                </ul>
                <p>للتفعيل النهائي لحسابك، يرجى النقر على الرابط التالي:</p>
                <a href="http://localhost:3000/activate/${phone}?password=${randomPassword}" style="padding: 10px; background-color: green; color: white; text-decoration: none;">تفعيل الحساب</a>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('خطأ في إرسال البريد الإلكتروني:', error);
                return res.status(500).json({ error: error.message });
            } else {
                console.log('تم إرسال البريد الإلكتروني بنجاح:', info.response);
            }
        });

        // توجيه المستخدم إلى صفحة login-provider.html بعد إتمام الدفع بنجاح
        return res.redirect('/login-provider.html');

    } catch (error) {
        console.error('خطأ أثناء معالجة الدفع:', error);
        return res.status(500).json({ error: error.message });
    }
});

// مسار التفعيل
app.get('/activate/:phone', async (req, res) => {
    const userPhone = req.params.phone;  // الحصول على رقم الهاتف من الرابط
    const { password } = req.query;  // الحصول على كلمة المرور من الرابط

    // استرجاع بيانات المستخدم من قاعدة البيانات
    const userRef = db.collection('users').doc(userPhone);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
    }

    const userData = userDoc.data();

    // تحديث حالة التفعيل للمستخدم وتخزين كلمة المرور
    await userRef.update({
        isActive: true,
        password: password,  // تخزين كلمة المرور الجديدة
        username: userPhone,  // تعيين اسم المستخدم (رقم الهاتف)
    });

    res.send(`<h2>تم تفعيل حسابك بنجاح!</h2><p>يمكنك الآن تسجيل الدخول باستخدام رقم هاتفك وكلمة المرور الجديدة.</p>`);
});

// رفض المستخدم مع إشعار بالسبب
app.get('/reject-user/:phone', async (req, res) => {
    const userPhone = req.params.phone;

    // إرسال إشعار بالبريد الإلكتروني
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: `${userPhone}@example.com`,  // استخدم رقم الهاتف في البريد
        subject: 'رفض طلب التسجيل',
        html: `<p>تم رفض طلب التسجيل الخاص بك. يرجى التواصل لمعرفة السبب.</p>`
    };

    transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
            console.log('خطأ في إرسال إشعار الرفض:', error);
            return res.status(500).json({ success: false, message: 'حدث خطأ أثناء إرسال البريد الإلكتروني.' });
        } else {
            console.log('تم إرسال إشعار الرفض:', info.response);

            // إزالة المستخدم من قاعدة البيانات
            const userRef = db.collection('users').doc(userPhone);
            await userRef.delete();

            return res.status(200).json({ success: true, message: 'تم رفض المستخدم وحذفه من النظام.' });
        }
    });
});

app.post('/login-provider', async (req, res) => {
    console.log('استلام طلب تسجيل الدخول');
    const { phone, password } = req.body;

    if (!phone || !password) {
        console.log('رقم الهاتف أو كلمة المرور مفقودة');
        return res.status(400).json({ success: false, message: "رقم الهاتف وكلمة المرور مطلوبان." });
    }

    // التحقق من الـ Admin
    if (phone === '0777777777' && password === 'admin') {
        console.log('تسجيل الدخول كأدمن');
        return res.json({ success: true, redirectTo: '/admin.html' });
    }

    try {
        const userRef = db.collection('users');
        const userSnapshot = await userRef.where('phone', '==', phone).get();
        if (userSnapshot.empty) {
            console.log('المستخدم غير موجود');
            return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
        }

        const userData = userSnapshot.docs[0].data();
        const passwordMatch = await bcrypt.compare(password, userData.password);

        if (!passwordMatch) {
            console.log('كلمة المرور غير صحيحة');
            return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة." });
        }

        if (!userData.isActive) {
            console.log('الحساب غير مفعل');
            return res.status(400).json({ success: false, message: "الحساب غير مفعل." });
        }

        req.session.driverId = userData.phone;
        req.session.driverName = userData.fullName;

        console.log('تم تسجيل الدخول بنجاح');
        res.json({ success: true, driverId: userData.phone });

    } catch (error) {
        console.error('خطأ أثناء تسجيل الدخول:', error);
        res.status(500).json({ success: false, message: "حدث خطأ في النظام." });
    }
});

// API لحجز الرحلة
app.post('/book-trip', async (req, res) => {
    const { tripId, departureLocation, arrivalLocation, departureTime, driverName, driverPhone, guestToken } = req.body;

    if (!tripId || !guestToken) {
        return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
    }

    try {
        // تحديث سجل الرحلة إلى "محجوزة"
        const tripRef = db.collection('trips').doc(tripId);
        await tripRef.update({ isBooked: true });

        // إضافة الرحلة إلى سجل الضيف
        const guestRef = db.collection('guests').doc(guestToken);
        await guestRef.update({
            bookedTrips: admin.firestore.FieldValue.arrayUnion({
                tripId,
                departureLocation,
                arrivalLocation,
                departureTime,
                driverName,
                driverPhone
            })
        });

        // إرسال إشعار للسائق
        const driverRef = db.collection('users').doc(driverPhone);
        const driverDoc = await driverRef.get();
        const driverData = driverDoc.data();

        if (driverData && driverData.fcmToken) {
            const message = {
                notification: {
                    title: 'حجز جديد للرحلة',
                    body: `تم حجز رحلة من ${departureLocation} إلى ${arrivalLocation} بواسطة ${guestToken}`
                },
                token: driverData.fcmToken
            };

            await admin.messaging().send(message);
        }

        res.json({ success: true, message: 'تم الحجز بنجاح' });
    } catch (error) {
        console.error('Error booking trip:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء الحجز' });
    }
});

// إضافة API لإضافة الرحلات
app.post('/add-trip', (req, res) => {
    const { departureLocation, departurePoint, arrivalLocation, arrivalPoint, departureTime, tripCost } = req.body;

    // تحقق من صحة البيانات
    if (!departureLocation || !departurePoint || !arrivalLocation || !arrivalPoint || !departureTime || !tripCost) {
        return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }

    // التحقق من وجود السائق في الجلسة
    const driverPhone = req.session.driverId;  // الحصول على رقم هاتف السائق من الجلسة
    if (!driverPhone) {
        return res.status(400).json({ success: false, message: 'لم يتم تحديد السائق.' });
    }

    // استرجاع بيانات السائق من قاعدة البيانات (users)
    const driverRef = db.collection('users').doc(driverPhone);
    driverRef.get().then(doc => {
        if (!doc.exists) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على بيانات السائق.' });
        }

        const driverData = doc.data();
        const driverName = driverData.fullName;
        const driverPhone = driverData.phone;

        // إضافة الرحلة إلى Firestore
        db.collection('trips').add({
            departureLocation,
            departurePoint,
            arrivalLocation,
            arrivalPoint,
            departureTime,
            tripCost,
            driverName,  // إضافة اسم السائق
            driverPhone, // إضافة رقم هاتف السائق
            createdAt: admin.firestore.FieldValue.serverTimestamp(),  // إضافة التاريخ والوقت
        })
        .then(docRef => {
            res.json({ success: true, message: 'تم إضافة الرحلة بنجاح', tripId: docRef.id });

            // بعد إضافة الرحلة، قم بتحديد الوقت لحذف الرحلة بعد ساعة
            const tripId = docRef.id;
            const createdAt = new Date().getTime();
            const oneHourLater = createdAt + 60 * 60 * 1000;  // إضافة ساعة (بالميللي ثانية)
            const delay = oneHourLater - Date.now();

            // استخدام setTimeout لحذف الرحلة بعد ساعة
            setTimeout(() => {
                db.collection('trips').doc(tripId).delete()
                    .then(() => {
                        console.log(`تم حذف الرحلة ${tripId} بعد ساعة من إضافتها.`);
                    })
                    .catch(error => {
                        console.error("حدث خطأ أثناء حذف الرحلة:", error);
                    });
            }, delay);
        })
        .catch(error => {
            console.error('خطأ أثناء إضافة الرحلة:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ في النظام' });
        });
    }).catch(error => {
        console.error('حدث خطأ أثناء استرجاع بيانات السائق:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في استرجاع بيانات السائق' });
    });
});

// استرجاع API لاسترجاع الرحلات بناءً على نقاط الانطلاق والوصول
app.get('/get-trips', async (req, res) => {
    const { departure, arrival } = req.query;

    if (!departure || !arrival) {
        return res.status(400).json({ success: false, message: 'يرجى تحديد نقطة الانطلاق والوصول.' });
    }

    try {
        // إعداد الاستعلام في Firestore لاسترجاع الرحلات المتوافقة
        const tripsRef = db.collection('trips');
        const q = tripsRef.where('departureLocation', '==', departure)
                          .where('arrivalLocation', '==', arrival);

        const querySnapshot = await q.get();
        const trips = [];

        querySnapshot.forEach(doc => {
            const trip = doc.data();
            trips.push({
                tripId: doc.id,
                departureLocation: trip.departureLocation,
                departurePoint: trip.departurePoint,
                arrivalLocation: trip.arrivalLocation,
                arrivalPoint: trip.arrivalPoint,
                departureTime: trip.departureTime,
                tripCost: trip.tripCost,
                driverName: trip.driverName,  // إضافة اسم السائق
                driverPhone: trip.driverPhone // إضافة رقم هاتف السائق
            });
        });

        if (trips.length > 0) {
            res.json({ success: true, trips });
        } else {
            res.json({ success: false, message: 'لا توجد رحلات متاحة لهذه النقاط.' });
        }
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في استرجاع الرحلات.' });
    }
});
// نقطة النهاية لتغيير كلمة المرور
app.post('/change-password', async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // التحقق من وجود الحقول
    if (!oldPassword || !newPassword || !confirmPassword) {
        console.log('الحقول المفقودة:', { oldPassword, newPassword, confirmPassword });
        return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة." });
    }

    // التحقق من تطابق كلمة المرور الجديدة مع تأكيد كلمة المرور
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "كلمة المرور الجديدة غير متطابقة مع تأكيد كلمة المرور." });
    }

    // استرجاع السائق من الجلسة
    const driverPhone = req.session.driverId;
    if (!driverPhone) {
        return res.status(400).json({ success: false, message: "لم تقم بتسجيل الدخول." });
    }

    try {
        // استرجاع بيانات السائق من قاعدة البيانات باستخدام رقم الهاتف
        const userRef = db.collection('users').doc(driverPhone);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
        }

        const user = userDoc.data();

        // التحقق من تطابق كلمة المرور القديمة مع الكلمة المخزنة في قاعدة البيانات
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

        if (!isOldPasswordValid) {
            return res.status(400).json({ success: false, message: "كلمة المرور القديمة غير صحيحة." });
        }

        // تشفير كلمة المرور الجديدة باستخدام bcrypt
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // تحديث كلمة المرور في قاعدة البيانات
        await userRef.update({ password: hashedNewPassword });

        res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح." });

    } catch (error) {
        console.error('خطأ أثناء تغيير كلمة المرور:', error);
        res.status(500).json({ success: false, message: "حدث خطأ في النظام." });
    }
});

// دالة لإرسال البريد الإلكتروني
async function sendEmail(to, subject, text) {
  const mailOptions = {
    from: 'salemhra86@gmail.com',  // استبدل هذا ببريدك الإلكتروني
    to: to,
    subject: subject,
    text: text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending email: ', error);
    throw error;  // إلقاء الخطأ ليتم التعامل معه في دالة الاستدعاء
  }
}

// نقطة النهاية لإرسال رابط إعادة تعيين كلمة المرور
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب.' });
    }

    try {
        const userRef = db.collection('users').where('email', '==', email);
        const snapshot = await userRef.get();

        if (snapshot.empty) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
        }

        const user = snapshot.docs[0].data();
        const userId = snapshot.docs[0].id;

        // توليد token فريد
        const token = crypto.randomBytes(20).toString('hex');

        // تخزين الـ token في قاعدة البيانات مع تاريخ إنشائه
        const resetTokenRef = db.collection('password-reset-tokens').doc(userId);
        await resetTokenRef.set({
            token: token,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // إرسال رابط إعادة تعيين كلمة المرور عبر البريد الإلكتروني
        const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
        await sendEmail(user.email, "إعادة تعيين كلمة المرور", `اضغط على الرابط لتغيير كلمة المرور: ${resetUrl}`);

        res.json({ success: true, message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' });
    } catch (error) {
        console.error('حدث خطأ:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في النظام.' });
    }
});

// نقطة النهاية لتغيير كلمة المرور
// نقطة النهاية لتغيير كلمة المرور (POST)
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'الرجاء إدخال جميع البيانات المطلوبة.' });
    }

    try {
        // التحقق من صحة الـ token في قاعدة البيانات
        const resetTokenRef = db.collection('password-reset-tokens').where('token', '==', token);
        const snapshot = await resetTokenRef.get();

        if (snapshot.empty) {
            return res.status(400).json({ success: false, message: 'الرمز غير صالح أو انتهت صلاحيته.' });
        }

        const userId = snapshot.docs[0].id;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
        }

        // تشفير كلمة المرور الجديدة
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // تحديث كلمة المرور في قاعدة البيانات
        await userRef.update({ password: hashedPassword });

        // حذف الـ token بعد أن تم استخدامه
        await snapshot.docs[0].ref.delete();

        // إعادة التوجيه إلى صفحة login-provider.html بعد تغيير كلمة المرور
        res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح.' });
    } catch (error) {
        console.error('حدث خطأ أثناء تغيير كلمة المرور:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في النظام.' });
    }
});

// نقطة النهاية لـ GET لعرض صفحة إعادة تعيين كلمة المرور
app.get('/reset-password', async (req, res) => {
    const token = req.query.token;  // أخذ الـ token من الرابط (query string)

    if (!token) {
        return res.status(400).json({ success: false, message: 'الرمز غير صالح.' });
    }

    try {
        // تحقق من صلاحية الـ token في قاعدة البيانات
        const resetTokenRef = db.collection('password-reset-tokens').where('token', '==', token);
        const snapshot = await resetTokenRef.get();

        if (snapshot.empty) {
            return res.status(400).json({ success: false, message: 'الرمز غير صالح أو انتهت صلاحيته.' });
        }

        // يمكنك هنا إرسال صفحة HTML التي تحتوي على النموذج الخاص بإعادة تعيين كلمة المرور
        res.send(`
            <!DOCTYPE html>
            <html lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>إعادة تعيين كلمة المرور</title>
            </head>
            <body>
                <h2>إعادة تعيين كلمة المرور</h2>
                <form id="reset-password-form">
                    <input type="hidden" id="token" value="${token}">
                    <label for="newPassword">كلمة المرور الجديدة:</label>
                    <input type="password" id="newPassword" name="newPassword" required>
                    <br>
                    <label for="confirmPassword">تأكيد كلمة المرور الجديدة:</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required>
                    <br>
                    <button type="submit">تغيير كلمة المرور</button>
                </form>
                
                <script>
                    document.getElementById('reset-password-form').addEventListener('submit', async function (e) {
                        e.preventDefault();

                        const token = document.getElementById('token').value;
                        const newPassword = document.getElementById('newPassword').value;
                        const confirmPassword = document.getElementById('confirmPassword').value;

                        if (newPassword !== confirmPassword) {
                            alert('كلمة المرور الجديدة غير متطابقة مع تأكيد كلمة المرور.');
                            return;
                        }

                        try {
                            const response = await fetch('/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token, newPassword })
                            });

                            const data = await response.json();
                            if (data.success) {
                                alert('تم تغيير كلمة المرور بنجاح.');
                            } else {
                                alert('حدث خطأ: ' + data.message);
                            }
                        } catch (error) {
                            alert('حدث خطأ أثناء تغيير كلمة المرور.');
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('خطأ أثناء معالجة طلب تغيير كلمة المرور:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في النظام.' });
    }
});



// التعامل مع صفحة الادمن

// نقطة النهاية لحذف الرحلة
app.delete('/delete-trip/:tripId', async (req, res) => {
    const tripId = req.params.tripId;
    try {
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        // تحقق من وجود الرحلة
        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
        }

        // حذف الرحلة
        await tripRef.delete();
        res.json({ success: true, message: 'تم حذف الرحلة بنجاح' });
    } catch (error) {
        console.error('حدث خطأ أثناء حذف الرحلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
    }
});

// نقطة النهاية لإلغاء الرحلة
app.patch('/cancel-trip/:tripId', async (req, res) => {
    const tripId = req.params.tripId;
    try {
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        // تحقق من وجود الرحلة
        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
        }

        // تحديث حالة الرحلة لإلغاء الحجز
        await tripRef.update({ isBooked: false });
        res.json({ success: true, message: 'تم إلغاء الرحلة بنجاح' });
    } catch (error) {
        console.error('حدث خطأ أثناء إلغاء الرحلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
    }
});

// نقطة النهاية لتجميد العضوية
app.patch('/freeze-user/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        // تحقق من وجود المستخدم
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        // تحديث حالة المستخدم لتجميد العضوية
        await userRef.update({ isActive: false });
        res.json({ success: true, message: 'تم تجميد العضوية بنجاح' });
    } catch (error) {
        console.error('حدث خطأ أثناء تجميد العضوية:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
    }
});

// نقطة النهاية لرفض المستخدم
app.delete('/reject-user/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        // تحقق من وجود المستخدم
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        // حذف المستخدم من قاعدة البيانات
        await userRef.delete();
        res.json({ success: true, message: 'تم رفض المستخدم بنجاح' });
    } catch (error) {
        console.error('حدث خطأ أثناء رفض المستخدم:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
    }
});  // تأكد من أن هذه القوس مغلق هنا



const PORT = process.env.PORT || 3000;
console.log(`Using port: ${PORT}`);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
