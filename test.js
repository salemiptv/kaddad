// test.js
const crypto = require('crypto');

function generateNonce() {
    return crypto.randomBytes(16).toString('base64');
}

console.log(generateNonce());
