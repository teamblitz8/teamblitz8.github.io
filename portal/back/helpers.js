const crypto = require('node:crypto');
const normalHeader = 'application/json; charset=UTF-8';

const convertBufferToString = (buffer) => {
    return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

const hash = (password, salt) => {
    const iterations = 100000;
    const digest = 'sha512';

    let salted;
    if (!salt) {
        salted = crypto.randomBytes(16);
    }
    else {
        salted = salt;
    }

    const buffer = crypto.pbkdf2Sync(password, salted, iterations, 64, digest);
    salted = convertBufferToString(salted);

    const output = {
        hash: convertBufferToString(buffer),
        salt: salted
    }
    return output;
}

const compare = (a, b) => {
	const encoder = new TextEncoder();
	const bufferA = encoder.encode(a);
	const bufferB = encoder.encode(b);
	
	if (bufferA.byteLength !== bufferB.byteLength) {
		crypto.subtle.timingSafeEqual(bufferA, bufferA);
		return false;
	}
	else {
		return crypto.subtle.timingSafeEqual(bufferA, bufferB);
	}
}

const buildResponse = async (message, status, contentType, object, blob) => {
    let finalObject = {...{ message: `${message} Timestamp: ${new Date().toISOString()}` }, ...object}
    if (object === 'BLOB') finalObject = blob;
    else finalObject = JSON.stringify(finalObject);

    return new Response(finalObject, {
        headers: {
            'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
            'Content-Type': contentType,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Vary': 'Origin',
            'Access-Control-Allow-Credentials': 'true'
        },
        status: status
    });
}

const log = async (type, pathname, request, message, stack) => {
	if (type === 'error') {
		console.error({
			timestamp: new Date().toISOString(),
			apiPath: pathname,
			message: message,
			originIP: request.headers.get('cf-connecting-ip'),
			originLocation: `${request.cf.city}, ${request.cf.country}`,
			errorStack: stack
		});
	}
	else if (type === 'warn') {
		console.warn({
			timestamp: new Date().toISOString(),
			apiPath: pathname,
			message: message,
			originIP: request.headers.get('cf-connecting-ip'),
			originLocation: `${request.cf.city}, ${request.cf.country}`
		});
	}
	else if (type === 'info') {
		console.log({
			timestamp: new Date().toISOString(),
			apiPath: pathname,
			message: message,
			originIP: request.headers.get('cf-connecting-ip'),
			originLocation: `${request.cf.city}, ${request.cf.country}`,
		});
	}
}

const checkRequest = async (pathname, request, expectedMethods, expectedContentHeader) => {
	let response;
	let success = true;

	if (!expectedMethods.includes(request.method)) {
		await log('warn', pathname, request, `Incorrect request method; expected ${expectedMethods}, received ${request.method}`);
		response = await buildResponse('There was an unexpected error.', 405, normalHeader);
		success = false;
	}

    if (expectedContentHeader) {
        const requestContentHeader = request.headers.get('Content-Type');
        if (requestContentHeader === null) {
            await log('warn', pathname, request, 'No content header received.');
            response = await buildResponse('There was an unexpected error.', 415, normalHeader);
            success = false;
        }

        const requestContentHeaders = requestContentHeader.split(';');
        if (requestContentHeaders[0].toLowerCase() !== expectedContentHeader.toLowerCase()) {
            await log('warn', pathname, request, `Required content header not found; expected ${expectedContentHeader}, received ${requestContentHeaders}`);
            response = await buildResponse('There was an unexpected error.', 415, normalHeader);
            success = false;
        }
    }

	return {
		success: success,
		response: response
	}
}

const parseRequestJSON = async (pathname, request, requiredFields) => {
	let json;
	let success = true;
	let response;

	try {
		try {
			json = await request.json();
		}
		catch (error) {
			log('warn', pathname, request, 'Malformed request body received; completely unparsable.', error);
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}

		if (json === null) {
			log('warn', pathname, request, 'Malformed request body received; request body is null.', error);
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}

		if (Array.isArray(json)) {
			log('warn', pathname, request, 'Malformed request body received; request body is an array.', error);
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}
		
		for (let i of requiredFields) {
			if (!Object.hasOwn(json, i)) {
				log('warn', pathname, request, 'Malformed request body received; completely unparsable.', error);
				response = await buildResponse('There was an unexpected error.', 400, normalHeader);
				success = false;
				throw new Error();
			}
		}

		throw new Error();
	}
	catch {
		return {
			success: success,
			response: response,
			json: json
		}
	}
}

const validateInputs = async (pathname, request, inputs, env, delay) => {
	/*
	i = {
		input
		requirements: {
			dataType,
			minLength,
			maxLength
		}
	}
	*/
	success = true;
	errorMsg = '';
	for (let i of inputs) {
		if (i.input === null) {
			success = false;
			errorMsg = `${Object.keys(i.input)[0]} is null`;
			break;
		}
		if (typeof i.input !== i.requirements.dataType) {
			success = false;
			errorMsg = `${Object.keys(i.input)[0]} does not match expected data type; expected ${i.requirements.dataType}, received ${typeof i.input}`;
			break;
		}
		if ((i.input.trim().length > i.requirements.maxLength) || (i.input.trim().length < i.requirements.minLength)) {
			success = false;
			errorMsg = `${Object.keys(i.input)[0]} does not match expected length; expected at least ${i.requirements.minLength} and at most ${i.requirements.maxLength}, received ${i.input.length}`;
			break;
		}
	}

	if (!success) {
		if (delay) {
			await checkUsername('67', env);
		}
		await log('warn', pathname, request, errorMsg);
		const response = await buildResponse('There was an unexpected error.', 400, normalHeader);
		return {
			success: false,
			response: response
		}
	}
	else {
		return {
			success: true
		}
	}
}

const handleIPBan = async (pathname, request, env) => {
	let allow = true;
	let response;

	const ip = request.headers.get('cf-connecting-ip');
	if (!ip) {
		allow = false;
		await log('warn', pathname, request, 'No IP address found');
		response = await buildResponse('There was an unexpected error.', 403, normalHeader);
	}

	const ipBanned = await checkIPBanned(pathname, request, ip, env);
	if (!ipBanned.success) {
		allow = false;
		response = await buildResponse('There was an unexpected error.', 500, normalHeader);
	}
	if (ipBanned.banned) {
		allow = false;
		response = await buildResponse('You have been blocked from making further attempts.', 429, normalHeader);
	}

	const { success } = await env.ratelimiter.limit({ key: ip });
	if (!success) {
		allow = false;
		response = await banIP(pathname, request, ip, env);
	}

	return {
		allow: allow,
		response: response
	}
}

const updateLastLogin = async (pathname, request, env, enteredUsername) => {
	const currentDate = (new Date()).toISOString();
	const statement = 'UPDATE users SET last_login = ? WHERE username = ?';

	try {
		const query = env.blitz.prepare(statement).bind(currentDate, enteredUsername);
		await query.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return await buildResponse('There was an unexpected error.', 500, normalHeader);
	}

	return await buildResponse('Logging in...', 200, normalHeader);
}

const checkIPBanned = async (pathname, request, ip, env) => {
	let result;
	try {
		const query = env.blitz.prepare('SELECT ip FROM ipbans');
		result = await query.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
		}
	}
	const banList = result.results;
	for (let i of banList) {
		if (i.ip === ip) {
			await log('warn', pathname, request, 'Attempt from a banned IP address was blocked');
			return {
				success: true,
				banned: true
			}
		}	
	}
	return {
		success: true,
		banned: false
	}
}

const banIP = async (pathname, request, ip, env) => {
	const currentDate = new Date().toISOString();

	try {
		const statement = 'INSERT INTO ipbans (ip, date_banned) VALUES (?, ?);'
		const insertion = env.blitz.prepare(statement).bind(ip, currentDate);
		await insertion.run();
		await log('info', pathname, request, `Successfully banned IP: ${ip}`);
		return await buildResponse('You have been blocked from making further attempts.', 429, normalHeader);
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return await buildResponse('There was an unexpected error.', 500, normalHeader);
	}
}

const checkUsername = async (username, env, pathname, request) => {
	let result;
	const statement = 'SELECT username FROM users WHERE username = ?';

	try {
		const query = env.blitz.prepare(statement).bind(username);
		result = await query.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (result.results.length === 0) {
		const fakeHash = hash('676767676767').hash;
		await compare(fakeHash, fakeHash);
		return {
			allow: false,
			response: await buildResponse('Invalid username or password', 401, normalHeader)
		}
	}
	else {
		return {
			allow: true
		}
	}
}

const authenticate = async (username, enteredPassword, env, pathname, request) => {
	const statement = 'SELECT password_hash, password_salt FROM users WHERE username = ?';
	let result;

	try {
		const query = env.blitz.prepare(statement).bind(username);
		result = await query.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	result = result.results;
	
	const trueHash = result[0]['password_hash'];
	const trueSalt = Buffer.from(result[0]['password_salt'], 'hex');

	const hashAttempt = hash(enteredPassword, trueSalt).hash;
	const hashesMatch = compare(trueHash, hashAttempt);

	if (hashesMatch) {
		return {
			allow: true
		}
	}
	else {
		return {
			allow: false,
			response: await buildResponse('Invalid username or password', 401, normalHeader)
		}
	}
}

const checkIfActive = async (username, env, pathname, request) => {
	const statement = 'SELECT active FROM users WHERE username = ?';
	let result;

	try {
		const query = env.blitz.prepare(statement).bind(username);
		result = await query.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}
	result = result.results[0].active;

	if (result === 1) {
		return {
			allow: true
		}
	}
	else {
		return {
			allow: false,
			response: await buildResponse('Your account has been disabled.', 403, normalHeader)
		}
	}
}

const addNewSessionToken = async (sessionToken, env, enteredUsername, pathname, request) => {
	const selectionStatement = 'SELECT userid FROM users WHERE username = ?';
	let selectionResult;

	try {
		const selection = env.blitz.prepare(selectionStatement).bind(enteredUsername);
		selectionResult = await selection.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${selectionStatement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	const userID = selectionResult.results[0].userid;

	const date = new Date();
	date.setDate(date.getDate() + 1);
	const expiry = date.toISOString();

	const tokenSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const hashedToken = hash(sessionToken, tokenSalt);
	const tokenHash = hashedToken.hash;

	const insertionStatement = 'INSERT INTO sessiontokens (session_token_hash, userid, expiration_date) VALUES (?, ?, ?);';
	try {
		const insertion = env.blitz.prepare(insertionStatement).bind(tokenHash, userID, expiry);
		await insertion.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${insertionStatement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	await log('info', pathname, request, 'Session token successfully generated');
	return {
		success: true
	}
}

const checkSessionToken = async (sessionToken, env, pathname, request) => {
	const theSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const attemptedHash = hash(sessionToken, theSalt).hash;
	const currentDate = (new Date()).toISOString();

	const statement = 'SELECT session_token_hash, userid FROM sessiontokens WHERE session_token_hash = ? AND expiration_date > ?';
	let results;
	try {
		const query = env.blitz.prepare(statement).bind(attemptedHash, currentDate);
		results = await query.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (results.results.length === 0) {
		return {
			allow: false,
			response: await buildResponse('You must be logged in to view this page.', 401, normalHeader)
		}
	}
	else {
		if (compare(attemptedHash, results.results[0]['session_token_hash'])) {
			return {
				allow: true,
				userid: results.results[0].userid
			}
		}
		else {
			return {
				allow: false,
				response: await buildResponse('You must be logged in to view this page.', 401, normalHeader)
			}
		}
	}
}

const parseCookies = (cookieHeader) => {
	const list = {};
	if (!cookieHeader) return list;

	cookieHeader.split(';').forEach((x) => {
		let [name, ...rest] = x.split('=');
		name = name?.trim();
		if (!name) return;
		const value = rest.join('=').trim();
		if (!value) return;
		list[name] = decodeURIComponent(value);
	});

	return list;
}

const checkSession = async (request, pathname, env) => {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies['session_token'];

    if (!sessionToken) {
        return {
            allow: false,
            response: await buildResponse('You must be logged in to view this page.', 401, normalHeader)
        }
    }

    const userid = await checkSessionToken(sessionToken, env, pathname, request);
    if (!userid.allow) {
        return {
            allow: false,
            response: userid.response
        }
    }
    return {
        allow: true,
        userid: userid.userid
    }
}

const fetchUserDataFromUserID = async (request, pathname, env, userid) => {
	const statement = 'SELECT name, username, last_login, iterations FROM users WHERE userid = ?';
	let results;

	try {
		const selection = env.blitz.prepare(statement).bind(userid);
		results = await selection.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
            success: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
	}
	
	if (results.results.length === 0) {
		await log('warn', pathname, request, `User record not found for userid ${userid}; expected name, username, last_login, iterations, received none`);
		return {
            success: false,
            response: await buildResponse('You must be logged in to view this page.', 401, normalHeader)
        }
	}
	else {
		let userObject = results.results[0];
		userObject.lastLogin = userObject['last_login'];
		delete userObject['last_login'];
        userObject.userID = userid;

        return {
            success: true,
            response: userObject
        }
	}
}

const fetchUserDataFromUsername = async (request, pathname, env, username) => {
    const statement = 'SELECT name, userid, last_login, iterations FROM users WHERE username = ?';
    let results;

    try {
        const selection = env.blitz.prepare(statement).bind(username);
        results = await selection.all();
    }
    catch (error) {
        await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
        return {
            success: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }
    
    if (results.results.length === 0) {
        await log('warn', pathname, request, `User record not found for username ${username}; expected name, userid, last_login, iterations, received none`);
        return {
            success: false,
            response: await buildResponse('User not found.', 404, normalHeader)
        }
    }
    else {
        let userObject = results.results[0];
        userObject.lastLogin = userObject['last_login'];
        delete userObject['last_login'];
        userObject.username = username;

        return {
            success: true,
            response: userObject
        }
    }
}

const fetchFromR2 = async (request, pathname, env, filepath, contentHeader) => {
    let file;

    try {
        file = env.blitzr2.get(filepath);
    }
    catch (error) {
        await log('error', pathname, request, `R2 query failed when attempting to fetch file at: ${filepath}`, error);
        return {
            success: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }

    if (file === null) {
        await log('warn', pathname, request, `File not found at path: ${filepath}; sending placeholder image`);

        const placeholderFetch = await fetchFromR2()
        if (!placeholderFetch.success) {
            return {
                success: false,
                response: placeholderFetch.response
            }
        }
        else {
            return {
                success: true,
                response: placeholderFetch.response
            }
        }
    }
    else {
        let finalPayload;

        try {
            finalPayload = file.blob();
        }
        catch (error) {
            await log('error', pathname, request, `Failed to perform blob() method on file at: ${filepath}`, error);
            return {
                success: false,
                response: await buildResponse('There was an unexpected error.', 500, normalHeader)
            }
        }

        return {
            success: true,
            response: await buildResponse('File successfully fetched', 200, contentHeader, 'BLOB', finalPayload)
        }
    }
}

module.exports = {
    convertBufferToString,
    hash,
    compare,
    addNewSessionToken,
    checkIfActive,
    authenticate,
    checkUsername,
    banIP,
    checkIPBanned,
    updateLastLogin,
    handleIPBan,
    validateInputs,
    parseRequestJSON,
    checkRequest,
    checkSessionToken,
    parseCookies,
    checkSession,
    fetchUserDataFromUserID,
    buildResponse,
    log,
    fetchFromR2,
    fetchUserDataFromUsername,
};