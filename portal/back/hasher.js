const crypto = require('node:crypto');
const readline = require('node:readline');
const salt = crypto.randomBytes(16);
const iterations = 676767;
const digest = 'sha512';

const convert = (buffer) => {
    return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

module.exports = {
    name: 'hasher',
    hash(password) {
        const buffer = crypto.pbkdf2Sync(password, salt, iterations, 74, digest);
        const output = {
            hash: convert(buffer),
            salt: salt
        }
    }
}

const thing = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

thing.question('Enter password: ', password => {
    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 74, digest);
    console.log(convert(derivedKey));
    thing.close();
})