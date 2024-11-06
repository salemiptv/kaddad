// إنشاء جدول المستخدم مع تخزين الصور كـ BLOB
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    nationalId TEXT NOT NULL CHECK (LENGTH(nationalId) = 10),
    carNumber TEXT NOT NULL CHECK (LENGTH(carNumber) = 6),
    code TEXT NOT NULL CHECK (LENGTH(code) = 2),
    carRegistrationNumber TEXT NOT NULL CHECK (LENGTH(carRegistrationNumber) = 13),
    carType TEXT NOT NULL,
    carColor TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL CHECK (LENGTH(phone) <= 15),
    carLicenseImage BLOB NOT NULL,
    carLicenseImageBack BLOB NOT NULL,
    driverLicenseImage BLOB NOT NULL
)`, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log("Users table created successfully with image fields as BLOB.");
});
