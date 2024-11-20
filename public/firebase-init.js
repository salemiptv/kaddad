// firebase-init.js

// استيراد Firebase
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// إعداد تكوين Firebase الخاص بمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyChm1-oS5eWjWeKap2HjMBu435chtbCNhU",
  authDomain: "kaddad-2.firebaseapp.com",
  databaseURL: "https://kaddad-2-default-rtdb.firebaseio.com",
  projectId: "kaddad-2",
  storageBucket: "kaddad-2.firebasestorage.app",
  messagingSenderId: "941546196207",
  appId: "1:941546196207:web:5c4c44513c3eedf1eedf1a",
  measurementId: "G-G9W8H9ZTF4"
};

/ تهيئة تطبيق Firebase
const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// تصدير التهيئة ليتم استخدامها في الملفات الأخرى
module.exports = { app, messaging };