// Import the functions you need from the SDKs you need
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js');

// تهيئة Firebase
const firebaseConfig = {
            apiKey: "AIzaSyAQ4qPKDRT7QGUKoJZOMHpu4vWjpCs8r7w",
            authDomain: "kaddad-3d621.firebaseapp.com",
            projectId: "kaddad-3d621",
            storageBucket: "kaddad-3d621.appspot.com",
            messagingSenderId: "95122086215",
            appId: "1:95122086215:web:62dd3b1983a38e2cc8946
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// التعامل مع الرسائل القادمة
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message: ', payload);
    // هنا يمكنك إضافة كود لإظهار الإشعار
});
