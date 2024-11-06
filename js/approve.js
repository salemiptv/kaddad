document.addEventListener("DOMContentLoaded", async () => {
    const email = getEmailFromUrl(); // دالة لجلب البريد الإلكتروني من URL
    const userInfoContainer = document.getElementById("user-info");

    // جلب بيانات المستخدم
    try {
        const response = await fetch(`/api/get-user-data/${email}`);
        const userData = await response.json();

        if (response.ok) {
            document.getElementById("full-name").textContent = userData.name;
            document.getElementById("national-id").textContent = userData.nationalId;
            document.getElementById("car-number").textContent = userData.carNumber;
            document.getElementById("car-color").textContent = userData.carColor;
            document.getElementById("email").textContent = userData.email;
            document.getElementById("phone").textContent = userData.phone;
        } else {
            userInfoContainer.innerHTML = `<p>${userData.message}</p>`;
        }
    } catch (error) {
        userInfoContainer.innerHTML = `<p>حدث خطأ أثناء جلب البيانات: ${error.message}</p>`;
    }

    // التعامل مع زر القبول
    document.getElementById("approve-button").addEventListener("click", async () => {
        const response = await fetch(`/approve-user/${email}`, { method: 'POST' });
        const result = await response.json();
        alert(result.message);
    });

    // التعامل مع زر الرفض
    document.getElementById("reject-button").addEventListener("click", () => {
        document.getElementById("reject-reason-modal").style.display = "block";
    });

    // التعامل مع زر إرسال سبب الرفض
    document.getElementById("send-reason-button").addEventListener("click", async () => {
        const reason = document.getElementById("reject-reason").value;
        const response = await fetch(`/reject-user/${email}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const result = await response.json();
        alert(result.message);
        document.getElementById("reject-reason-modal").style.display = "none";
        document.getElementById("reject-reason").value = ""; // إعادة تعيين السبب
    });

    // التعامل مع زر الإلغاء
    document.getElementById("cancel-button").addEventListener("click", () => {
        document.getElementById("reject-reason-modal").style.display = "none";
        document.getElementById("reject-reason").value = ""; // إعادة تعيين السبب
    });
});

// دالة لجلب البريد الإلكتروني من URL
function getEmailFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('email');
}
