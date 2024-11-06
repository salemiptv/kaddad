// استيراد المكتبات المطلوبة
require('dotenv').config();
const helmet = require('helmet');
const twilio = require('twilio');
const express = require('express');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const admin = require('firebase-admin'); // استيراد Firebase Admin SDK
const bcrypt = require('bcrypt'); // لتشفير كلمات المرور
const jwt = require('jsonwebtoken'); // استيراد JWT

// طباعة متغيرات البيئة للتأكد من تحميلها بشكل صحيح
console.log("Twilio Account SID:", process.env.TWILIO_ACCOUNT_SID);
console.log("Twilio Auth Token:", process.env.TWILIO_AUTH_TOKEN);

// إعداد Firebase باستخدام مفتاح الخدمة
const serviceAccount = require('./config/kaddad-2-firebase-adminsdk-wur0x-bcd92ff991.json');

// تهيئة التطبيق
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kaddad-440015-default-rtdb.firebaseio.com"
});

// تعريف قاعدة البيانات (Firestore)
const db = admin.firestore();

// إعداد Twilio
const accountSid = 'AC4245e7044de491a9f3028d3902c3ae66';
const authToken = 'a57e5fa7003cbbe0205df49dfb7a690e';

// التحقق من أن حساب Twilio SID و Auth Token ليسا undefined
if (!accountSid || !authToken) {
    console.error("Error: Twilio credentials are not set in the environment variables.");
    process.exit(1); // إنهاء التطبيق في حالة عدم وجود المتغيرات
}

const twilioClient = twilio(accountSid, authToken); // تهيئة عميل Twilio

// إعداد Express
const app = express();

app.use('/approve-user', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public'))); // تحديد المسارات الثابتة
app.use(bodyParser.json()); // استخدام body-parser لتحليل JSON
app.use(bodyParser.urlencoded({ extended: true })); // تفسير بيانات النموذج
app.use(express.json());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "chrome-extension://56d6285f-bbd7-408a-b3f2-94b243acf06e"]
    }
  })
);

// إضافة سياسة أمان المحتوى
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://code.jquery.com https://cdn.jsdelivr.net https://stackpath.bootstrapcdn.com; style-src 'self' https://stackpath.bootstrapcdn.com;"
    );
    next();
});

// مثال على إرسال رسالة باستخدام Twilio عند رفض المستخدم
app.post('/reject-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const reason = req.body.reason;

    try {
        await twilioClient.messages.create({
            body: `عذرًا، تم رفض حسابك بسبب: ${reason}`,
            from: process.env.TWILIO_PHONE_NUMBER, // رقم الهاتف الخاص بحساب Twilio
            to: userId // رقم هاتف المستخدم الذي يتم إرسال الرسالة له
        });
        res.status(200).json({ message: "تم رفض المستخدم وإرسال الرسالة بنجاح" });
    } catch (error) {
        console.error("Error rejecting user:", error);
        res.status(500).json({ message: "خطأ في رفض المستخدم" });
    }
});



// Your web app's Firebase configuration

const firebaseConfig = {
  apiKey: "IzaSyChm1-oS5eWjWeKap2HjMBu435chtbCNhU",
  authDomain: "kaddad-2.firebaseapp.com",
   databaseURL: "https://kaddad-2-default-rtdb.firebaseio.com/",
  projectId: "kaddad-2",
  storageBucket: "kaddad-2.firebasestorage.app",
  messagingSenderId: "941546196207",
  appId: "1:941546196207:web:5c4c44513c3eedf1eedf1a"
};

// عرض الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// إعداد multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// تسجيل مستخدم مع رفع الصور
app.post('/register', upload.fields([
    { name: 'carLicenseImage', maxCount: 1 },
    { name: 'carLicenseImageBack', maxCount: 1 },
    { name: 'driverLicenseImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { fullName, nationalId, carNumber, code, carRegistrationNumber, carType, carColor, email, phone } = req.body;

        // Check for all required fields
        if (!fullName || !nationalId || !carNumber || !code || !carRegistrationNumber || !carType || !carColor || !email || !phone) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة." });
        }

        // Check if files are uploaded
        if (!req.files['carLicenseImage'] || !req.files['carLicenseImageBack'] || !req.files['driverLicenseImage']) {
            return res.status(400).json({ success: false, message: "جميع الصور مطلوبة." });
        }

        // Create new user object
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
            fcmToken: '<USER_FCM_TOKEN>' // Update this after obtaining a real token
        };

        // Add user to the database
        await addUser(newUser);

        // Redirect to login page after success
        res.redirect('/login-provider.html'); // Ensure you have this page
    } catch (error) {
        console.error('خطأ أثناء تسجيل المستخدم:', error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء التسجيل." });
    }
});

// إضافة المستخدم إلى قاعدة البيانات
async function addUser(newUser) {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(newUser.email);

    try {
        await userRef.set(newUser);
        console.log(`تم إدخال مستخدم برقم التعريف: ${newUser.email}`);
        notifyAdmin(newUser);
    } catch (error) {
        console.error('خطأ في إدخال المستخدم:', error);
    }
}

// دالة تسجيل الدخول باستخدام رقم الهاتف
app.post('/login', async (req, res) => {
    const { phone, password } = req.body;

    try {
        const userRef = admin.firestore().collection('users').doc(phone); // استخدم رقم الهاتف كمفتاح
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, message: "المستخدم غير موجود." });
        }

        const user = doc.data();

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة." });
        }

        const token = jwt.sign({ phone: user.phone }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        res.json({ success: true, token });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء تسجيل الدخول." });
    }
});

// إنشاء حساب جديد
app.post('/create-account', async (req, res) => {
    const { fullName, email, password } = req.body;

    // التحقق من وجود جميع الحقول المطلوبة
    if (!fullName || !email || !password) {
        return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة." });
    }

    // هنا يمكنك إضافة الكود لتشفير كلمة المرور وتخزين المستخدم في قاعدة البيانات
    const hashedPassword = await bcrypt.hash(password, 10); // تشفير كلمة المرور

    const newUser = {
        fullName,
        email,
        password: hashedPassword,
        // أضف أي بيانات أخرى تحتاجها
    };

    // استدعاء الدالة لإضافة المستخدم (مثل addUser)
    await addUser(newUser); // تأكد من وجود الدالة addUser

    res.status(200).json({ success: true, message: "تم إنشاء الحساب بنجاح." });
});


// إعداد البريد الإلكتروني لإشعار المسؤول عن تسجيل مستخدم جديد
function notifyAdmin(newUser) {
    const acceptLink = `http://localhost:3000/approve-user/${newUser.email}`;
    const rejectLink = `http://localhost:3000/reject-user/${newUser.email}`;

    const htmlContent = `
        <h2>طلب تسجيل مستخدم جديد</h2>
        <p>مستخدم جديد قام بالتسجيل. التفاصيل كما يلي:</p>
        <ul>
            <li><strong>الاسم الكامل:</strong> ${newUser.fullName}</li>
            <li><strong>الرقم الوطني:</strong> ${newUser.nationalId}</li>
            <li><strong>رقم السيارة:</strong> ${newUser.carNumber}</li>
            <li><strong>اللون:</strong> ${newUser.carColor}</li>
            <li><strong>البريد الإلكتروني:</strong> ${newUser.email}</li>
            <li><strong>رقم الهاتف:</strong> ${newUser.phone || 'غير متوفر'}</li>
        </ul>
        <p>الرجاء اتخاذ الإجراء المناسب:</p>
        <a href="${acceptLink}" style="padding: 10px 20px; background-color: green; color: white; text-decoration: none; border-radius: 5px;">قبول</a>
        <a href="${rejectLink}" style="padding: 10px 20px; background-color: red; color: white; text-decoration: none; border-radius: 5px;">رفض</a>
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'طلب تسجيل مستخدم جديد',
        html: htmlContent,
    };

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('خطأ في إرسال البريد الإلكتروني:', error);
        }
        console.log('تم إرسال البريد الإلكتروني بنجاح:', info.response);
    });
}

// نقطة نهاية POST للموافقة على المستخدم
app.post('/approve-user/:email', async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.params.email);
        await userRef.update({ approved: true });
        res.json({ message: 'تمت الموافقة على المستخدم بنجاح!' });
    } catch (error) {
        console.error('خطأ في الموافقة على المستخدم:', error);
        res.status(500).send('خطأ في الخادم الداخلي');
    }
});

// إعداد Route لرفض المستخدم
app.post('/reject-user/:email', async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.params.email);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'لم يتم العثور على المستخدم.' });
        }

        const userData = doc.data();
        if (!userData.token) {
            return res.status(400).json({ message: 'رقم الهاتف غير موجود لهذا المستخدم.' });
        }

        // مسح بيانات المستخدم من قاعدة البيانات
        await userRef.delete();

        // إرسال إشعار للمستخدم
        const message = {
            notification: {
                title: 'رفض الطلب',
                body: 'عذرًا، تم رفض طلبك.',
            },
            token: userData.token, // استخدم التوكن الخاص بالمستخدم
        };

        // إرسال الإشعار
        admin.messaging().send(message)
            .then((response) => {
                console.log('تم إرسال الإشعار بنجاح:', response);
                res.json({ message: 'تم رفض المستخدم وتم إرسال إشعار له.' });
            })
            .catch((error) => {
                console.error('خطأ في إرسال الإشعار:', error);
                res.status(500).send('خطأ في إرسال الإشعار');
            });

    } catch (error) {
        console.error('Error rejecting user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// نقطة نهاية GET لجلب واجهة الموافقة على المستخدم
app.set('view engine', 'ejs');
app.set('views', './views');

// دالة GET لجلب واجهة الموافقة على المستخدم
app.get('/approve-user/:email', async (req, res) => {
    const email = req.params.email;
    console.log('Receiving request for email:', email);

    try {
        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log('User not found:', email);
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
        }

        const userData = doc.data();
        console.log('User data retrieved:', userData);

        // تمرير بيانات المستخدم إلى القالب
        res.render('approve-user', { 
            userId: email,
            userName: userData.fullName || 'اسم غير متوفر',
            userData: userData
        });
    } catch (error) {
        console.error('خطأ في جلب بيانات المستخدم:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب البيانات.' });
    }
});

app.get('/api/get-user-data/:email', async (req, res) => {
    const email = req.params.email;

    try {
        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
        }

        const userData = doc.data();
        res.status(200).json({
            id: email,
            phone: userData.phone || 'رقم الهاتف غير متوفر',
            name: userData.fullName || 'اسم غير متوفر',
            nationalId: userData.nationalId || 'غير متوفر',
            carNumber: userData.carNumber || 'غير متوفر',
            carColor: userData.carColor || 'غير متوفر',
            carType: userData.carType || 'غير متوفر',
            email: userData.email || 'البريد الإلكتروني غير متوفر'
        });
    } catch (error) {
        console.error('خطأ في جلب بيانات المستخدم:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب البيانات.', error: error.message });
    }
});


// تقديم الرحلات
app.post('/add-trip', authenticateToken, async (req, res) => {
    const { 
        departure, 
        departurePoint, 
        arrival, 
        arrivalPoint, 
        time, 
        cost 
    } = req.body;

    if (!departure || !departurePoint || !arrival || !arrivalPoint || !time || !cost) {
        return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة." });
    }

    const trip = {
        departure,
        departurePoint,
        arrival,
        arrivalPoint,
        time,
        cost
    };

    await addTrip(trip);
    res.status(200).json({ success: true, message: "تم إدخال الرحلة بنجاح." });
});

// إضافة الرحلة إلى قاعدة البيانات
async function addTrip(trip) {
    const db = admin.firestore();
    const tripRef = db.collection('trips').doc();

    try {
        await tripRef.set(trip);
        console.log('تم إدخال الرحلة بنجاح.');
    } catch (error) {
        console.error('خطأ في إدخال الرحلة:', error);
    }
}

// دالة إرسال إشعار عبر Firebase
async function sendNotification(user, message) {
    const registrationToken = user.fcmToken; // تأكد من أنك قد خزنت fcmToken في بيانات المستخدم

    const messagePayload = {
        notification: {
            title: 'إشعار جديد',
            body: message,
        },
        token: registrationToken,
    };

    try {
        const response = await admin.messaging().send(messagePayload);
        console.log('تم إرسال الرسالة بنجاح:', response);
    } catch (error) {
        console.error('فشل في إرسال الرسالة:', error);
    }
}

// توجيه إلى صفحة الدفع
app.get('/payment/:email', (req, res) => {
    const email = req.params.email;
    res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// نقطة النهاية الجديدة لجلب الرحلات
app.get('/get-trips', async (req, res) => {
    const db = admin.firestore();
    const tripsRef = db.collection('trips');
    const snapshot = await tripsRef.get();
    
    const trips = [];
    snapshot.forEach(doc => {
        trips.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({ success: true, trips });
});

// التحقق من صلاحية رمز JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// بدء الخادم
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`التطبيق يعمل على http://localhost:${port}`);
});
