document.getElementById('account-settings-form').addEventListener('submit', function(event) {
    event.preventDefault(); // منع إرسال النموذج الافتراضي

    // الحصول على قيم الحقول
    const username = document.getElementById('username').value;
    const phone = document.getElementById('phone').value;
    const currentPassword = document.getElementById('password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // التحقق من إدخال كلمة مرور جديدة وتأكيدها
    if (newPassword && newPassword !== confirmPassword) {
        alert('كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقتين.');
        return; // منع إرسال النموذج
    }

    // إعداد البيانات لإرسالها إلى الخادم
    const formData = {
        username: username,
        phone: phone,
        currentPassword: currentPassword,
        newPassword: newPassword
    };

    // إرسال البيانات إلى الخادم عبر طلب AJAX أو Fetch
    fetch('/update-account', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('تم تحديث البيانات بنجاح.');
        } else {
            alert('حدث خطأ: ' + data.message);
        }
    })
    .catch(error => {
        console.error('حدث خطأ أثناء تحديث الحساب:', error);
        alert('تعذر تحديث الحساب. حاول مرة أخرى.');
    });
});
