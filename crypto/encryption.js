const crypto = require("crypto");

function encryptPassword(password, salt) {
    const ITERATIONS = 10000;
    const KEY_LENGTH = 64;
    const encryptedPassword = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
    return(encryptedPassword.toString('base64'));
};

module.exports = {
    encryptPassword
}