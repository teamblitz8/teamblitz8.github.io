const crypto = require('node:crypto');
const readline = require('node:readline');
const iterations = 100000;
const digest = 'sha512';

const convert = (buffer) => {
    return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

// account setup tool
const input = (y) => {
    return new Promise(function(resolve, reject) {
        const thing = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        thing.question(`Enter ${y}: `, x => {
            resolve(x);
            thing.close();
        });
    })
}
const setup = async () => {
    return new Promise(async function(resolve, reject) {
        console.log('Set up a new user account.')
        let uuid = convert(crypto.randomBytes(16));
        let username = await input('username');
        let hash;
        let salt;
        let lastLogin = (new Date()).toISOString();
        let active = 1;
        let designIterations = 0;

        const password = await input('password');
        const salty = crypto.randomBytes(16);
        const derivedKey = crypto.pbkdf2Sync(password, salty, iterations, 64, digest);

        hash = convert(derivedKey);
        salt = convert(salty);

        resolve({
            userID: uuid,
            username: username,
            passwordHash: hash,
            passwordSalt: salt,
            lastLogin: lastLogin,
            active: active,
            iterations: designIterations
        });
    })
}

const a = async () => {
    console.log(await setup());
}

a();