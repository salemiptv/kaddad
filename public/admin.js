import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js';

// إعداد Firebase باستخدام التكوين الذي قدمته
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

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// جلب بيانات المستخدمين من Firestore
const getUsers = async () => {
    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        
        snapshot.forEach(doc => {
            const user = doc.data();
            const userId = doc.id;
            displayUser(user, userId);
        });
    } catch (error) {
        console.error("خطأ في جلب المستخدمين:", error);
    }
};

// جلب بيانات الرحلات من Firestore
const getTrips = async () => {
    try {
        const tripsRef = collection(db, "trips");
        const snapshot = await getDocs(tripsRef);
        
        snapshot.forEach(doc => {
            const trip = doc.data();
            const tripId = doc.id;
            const driverId = trip.driverId; // افتراض أن هناك معرف للسائق في الرحلة
            displayTrip(trip, tripId, driverId);
        });
    } catch (error) {
        console.error("خطأ في جلب الرحلات:", error);
    }
};

// جلب بيانات الضيوف من Firestore
const getGuests = async () => {
    try {
        const guestsRef = collection(db, "guests");
        const snapshot = await getDocs(guestsRef);

        snapshot.forEach(doc => {
            const guest = doc.data();
            const guestId = doc.id;
            displayGuest(guest, guestId);
        });
    } catch (error) {
        console.error("خطأ في جلب الضيوف:", error);
    }
};

// عرض المستخدمين في الجدول
const displayUser = (user, userId) => {
    const table = document.getElementById("user-table").getElementsByTagName('tbody')[0];
    const row = table.insertRow();
    
    row.innerHTML = `
        <td>${user.fullName}</td>
        <td><a href="tel:${user.phone}">${user.phone}</a></td>
        <td><a href="mailto:${user.email}">${user.email}</a></td>
        <td>${user.isActive ? "مفعل" : "غير مفعل"}</td>
        <td>
            <button class="button button-danger" onclick="rejectUser('${userId}')">رفض</button>
            <button class="button button-warning" onclick="freezeUser('${userId}')">تجميد العضوية</button>
        </td>
    `;
};

// عرض الرحلات في الجدول مع عدد الرحلات المحجوزة
const displayTrip = async (trip, tripId, driverId) => {
    const table = document.getElementById("trip-table").getElementsByTagName('tbody')[0];
    const row = table.insertRow();
    
    // جلب عدد الرحلات المحجوزة لهذا السائق
    const bookedTripsQuery = query(collection(db, "trips"), where("driverId", "==", driverId), where("isBooked", "==", true));
    const bookedTripsSnapshot = await getDocs(bookedTripsQuery);
    const bookedTripsCount = bookedTripsSnapshot.size;

    row.innerHTML = `
        <td>${trip.departureLocation} - ${trip.arrivalLocation}</td>
        <td>${trip.departureTime}</td>
        <td><a href="tel:${trip.driverPhone}">${trip.driverName}</a></td>
        <td>${bookedTripsCount}</td>
        <td>${trip.isBooked ? "محجوزة" : "متاحة"}</td>
        <td>
            <button class="button button-danger" onclick="deleteTrip('${tripId}')">حذف</button>
            <button class="button button-danger" onclick="cancelTrip('${tripId}')">إلغاء</button>
        </td>
    `;
};

// عرض الضيوف في الجدول
const displayGuest = (guest, guestId) => {
    const table = document.getElementById("guest-table").getElementsByTagName('tbody')[0];
    const row = table.insertRow();
    
    row.innerHTML = `
        <td>${guest.fullName}</td>
        <td><a href="tel:${guest.phone}">${guest.phone}</a></td>
        <td><a href="mailto:${guest.email}">${guest.email}</a></td>
        <td>
            <button class="button button-danger" onclick="deleteGuest('${guestId}')">حذف</button>
        </td>
    `;
};

// دالة لحذف الرحلة
const deleteTrip = async (tripId) => {
    try {
        const tripRef = doc(db, "trips", tripId);
        await deleteDoc(tripRef);
        alert("تم حذف الرحلة بنجاح");
        location.reload();
    } catch (error) {
        console.error("خطأ في حذف الرحلة:", error);
    }
};

// دالة لحذف الضيف
const deleteGuest = async (guestId) => {
    try {
        const guestRef = doc(db, "guests", guestId);
        await deleteDoc(guestRef);
        alert("تم حذف الضيف بنجاح");
        location.reload();
    } catch (error) {
        console.error("خطأ في حذف الضيف:", error);
    }
};

// دالة لرفض المستخدم
const rejectUser = async (userId) => {
    try {
        const userRef = doc(db, "users", userId);
        await deleteDoc(userRef);
        alert("تم رفض المستخدم بنجاح");
        location.reload();
    } catch (error) {
        console.error("خطأ في رفض المستخدم:", error);
    }
};

// دالة لتجميد العضوية
const freezeUser = async (userId) => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { isActive: false });
        alert("تم تجميد العضوية بنجاح");
        location.reload();
    } catch (error) {
        console.error("خطأ في تجميد العضوية:", error);
    }
};

// تحميل البيانات عند تحميل الصفحة
window.onload = () => {
    getUsers();
    getTrips();
    getGuests();
};
