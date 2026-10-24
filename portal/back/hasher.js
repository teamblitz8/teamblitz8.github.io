const crypto = require('node:crypto');
const iterations = 676767;
const digest = 'sha512';

const convert = (buffer) => {
    return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

module.exports = {
    name: 'hasher',
    hash(password, salt) {
        let salted;
        if (!salt) {
            salted = crypto.randomBytes(16);
        }
        else {
            salted = salt;
        }
        const buffer = crypto.pbkdf2Sync(password, salted, iterations, 64, digest);
        salted = convert(salted);
        const output = {
            hash: convert(buffer),
            salt: salted
        }
        return output;
    }
}