const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    nationalId: { type: String, required: true },
    carNumber: { type: String, required: true },
    carCode: { type: String, required: true },
    carReg: { type: String, required: true },
    carType: { type: String, required: true },
    carColor: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
