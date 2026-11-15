const crypto = require('node:crypto');
const normalHeader = 'application/json; charset=UTF-8';

/**
 * Converts a buffer, such as one generated from a cryptographic hashing algorithm, into a string.
 * @param {buffer} buffer The buffer to be converted into a string.
 * @returns {string} The buffer in string format, suitable for committing to an SQL database.
 */
const convertBufferToString = (buffer) => {
    return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a password using a provided salt or randomly generated salt using the HMAC-PBKDF2-SHA512 hashing algorithm.
 * @param {string} password The password to be hashed.
 * @param {string} [salt] Optional salt to hash with. If undefined, a randomly generated salt is used.
 * @returns {{ hash: string, salt: string }} The hashed password and the salt used, in an object.
 */
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

/**
 * Compares two buffers in string format, with two buffers being either equal or different taking equal time to defend against timing attacks. 
 * @param {string} a A buffer.
 * @param {string} b The buffer you want to compare against the other buffer.
 * @returns {boolean} A boolean, with `true` indicating they are equal, and `false` indicating they are not equal.
 */
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

/**
 * Creates a timestamped HTTP response based on the HTTP status, message, and headers needed, with support for both JavaScript objects and binary blobs.
 * @param {string} message The message to be sent to the client.
 * @param {number} status The HTTP status code to be sent.
 * @param {string} contentType The value of the Content-Type header to be sent.
 * @param {object | string} object The JavaScript object to be sent, or an indication that a blob is to be sent.
 * @param {blob | undefined} blob The blob to be sent, if applicable.
 * @param {string | undefined} disposition The value of the Content-Disposition header to be sent, if a blob is to be sent.
 * @returns {Response} A Response object with the required parameters built.
 */
const buildResponse = async (message, status, contentType, object, blob, disposition) => {
    let finalObject = {...{ message: `${message} Timestamp: ${new Date().toISOString()}` }, ...object}
    if (object === 'BLOB') finalObject = blob;
    else finalObject = JSON.stringify(finalObject);

    return new Response(finalObject, {
        headers: {
            'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
            'Content-Type': contentType,
			'Content-Disposition': disposition,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Vary': 'Origin',
            'Access-Control-Allow-Credentials': 'true',
			'Access-Control-Expose-Headers': 'Content-Disposition'
        },
        status: status
    });
}

/**
 * Logs something to the console, along with helpful information that may help with debugging.
 * @param {'error' | 'warn' | 'log'} type The log level - either `error`, `warn` or `log`.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {string} message The message to be sent along with the log.
 * @param {Error} [stack] The Error object if applicable.
 * @returns {void}
 */
const log = (type, pathname, request, message, stack) => {
    const errorStack = stack instanceof Error
        ? {
            name: stack.name,
            message: stack.message,
            stack: stack.stack
        }
        : stack;

	if (type === 'error') {
		console.error({
			timestamp: new Date().toISOString(),
			apiPath: pathname,
			message: message,
			originIP: request.headers.get('cf-connecting-ip'),
			originLocation: `${request.cf.city}, ${request.cf.country}`,
			errorStack: errorStack
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

/**
 * Checks if the request is of the correct method and contains the correct Content-Type header.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {Array<'GET' | 'POST' | 'PUT' | 'HEAD' | 'OPTIONS' | 'QUERY' | 'DELETE' | 'CONNECT' | 'TRACE' | 'PATCH'>} expectedMethods An Array of the expected methods that are to be received by the endpoint.
 * @param {Array<string>} expectedContentHeaders An Array of the expected values of the Content-Type header on the request.
 * @returns {Promise<{ success: boolean, response: Response | undefined }>}
 */
const checkRequest = async (pathname, request, expectedMethods, expectedContentHeaders) => {
	let response;
	let success = true;

    try {
        if (!expectedMethods.includes(request.method)) {
            await log('warn', pathname, request, `Incorrect request method; expected ${expectedMethods}, received ${request.method}`);
            response = await buildResponse('There was an unexpected error.', 405, normalHeader);
            success = false;
            throw new Error();
        }

        if (expectedContentHeaders) {
            const requestContentHeader = request.headers.get('Content-Type');
            if (requestContentHeader === null) {
                await log('warn', pathname, request, 'No content header received.');
                response = await buildResponse('There was an unexpected error.', 415, normalHeader);
                success = false;
                throw new Error();
            }

            const requestContentHeaders = requestContentHeader.split(';');
            if (!expectedContentHeaders.includes(requestContentHeaders[0].toLowerCase())) {
                await log('warn', pathname, request, `Required content header not found; expected ${expectedContentHeaders}, received ${requestContentHeaders}`);
                response = await buildResponse('There was an unexpected error.', 415, normalHeader);
                success = false;
                throw new Error();
            }
        }
        throw new Error();
    }
    catch {
        return {
            success: success,
            response: response
        }
    }
}

/**
 * Parses JSON sent by a POST request into a JavaScript object, ensuring it is not malformed and is of expected structure.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {Array<string>} requiredFields An Array of the expected property values within the Object once parsed.
 * @returns {Promise<{ success: boolean, response: Response | undefined, json: Object | undefined }>}
 */
const parseRequestJSON = async (pathname, request, requiredFields) => {
	let json;
	let success = true;
	let response;

	try {
		try {
			json = await request.json();
		}
		catch (error) {
			await log('warn', pathname, request, 'Malformed request body received; completely unparsable.', error);
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}

		if (json === null) {
			await log('warn', pathname, request, 'Malformed request body received; request body is null.');
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}

		if (Array.isArray(json)) {
			await log('warn', pathname, request, 'Malformed request body received; request body is an array.');
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}
		
		for (let i of requiredFields) {
			if (!Object.hasOwn(json, i)) {
				await log('warn', pathname, request, 'Malformed request body received; completely unparsable.');
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

/**
 * Parses a Blob sent by a POST or PUT request, ensuring that it does not exceed a maximum size.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {number} maxSize The maximum size (in bytes) of the blob.
 * @returns {Promise<{ success: Boolean, response: Response | undefined, blob: Blob | undefined }>}
 */
const parseRequestBlob = async (pathname, request, maxSize) => {
    let blob;
    try {
        blob = await request.blob();
    }
    catch (error) {
        await log('error', pathname, request, 'Failed to perform blob() method on request', error);
        return {
            success: false,
            response: await buildResponse('There was an unexpected error.', 400, normalHeader)
        }
    }

    if ((blob.size === 0) || (blob.size > maxSize)) {
        await log('info', pathname, request, `Attempt to upload file with size ${blob.size} bytes blocked; exceeded maximum limit of ${maxSize} bytes`);
        return {
            success: false,
            response: await buildResponse(`File uploaded exceeds maximum size of `, 400, normalHeader)
        }
    }
    
    return {
        success: true,
        blob: blob
    }
}

/**
 * A JavaScript object which bundles the parameters required for a database check during input validation.
 * @typedef {Object} dbCheck
 * @property {string} statement The SQL statement to be executed on the database.
 * @property {Array<string>} [vars] The bindings to be made onto the statement, to prevent SQL injection attacks.
 * @property {string | number | boolean | date} exclusion The specific exception which the input must match exactly where an SQL query is not to be carried out.
 */

/**
 * A JavaScript object which lists all requirements the input value must satisfy during input validation.
 * @typedef {Object} requirements
 * @property {'string' | 'boolean' | 'number' | 'date'} dataType The expected data type of the input value.
 * @property {number} [minLength] The minimum length the input must be (strings only).
 * @property {number} [maxLength] The maximum length the input must be (strings only).
 * @property {number} [minValue] The minimum value of the input (numbers only).
 * @property {number} [maxValue] The maximum value of the input (numbers only).
 * @property {boolean} [integer] Whether the input provided must be an integer (numbers only).
 * @property {Array<string>} [specificValues] The specific values that the input value must satisfy at least one of.
 * @property {dbCheck} [dbCheck] If applicable, the details of a database check to be conducted during validation.
 */

/**
 * A JavaScript Object which bundles a raw input and the requirements it must satisfy during input validation.
 * @typedef {Object} inputData
 * @property {string} name The name of the input (so it can be identified within logs if an error occurs).
 * @property {string | number | boolean | Date} input The input itself.
 * @property {requirements} requirements A JavaScript object which lists all requirements the input value must satisfy during input validation.
 */

/**
 * Performs input validation on data organised in a JavaScript object.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {Array<inputData>} inputs An Array of inputs and their requirements organised within their own JavaScript objects.
 * @param {Env} env
 * @param {boolean} delay Whether or not to delay with a hashing attempt (for defense against timing attacks). If `true` is passed, the function's output is delayed. If `false` is passed, the function runs without delay.
 * @returns {{ success: boolean, response: Response | undefined }}
 */
const validateInputs = async (pathname, request, inputs, env, delay) => {
	/*
	i = {
        name
		input
		requirements: {
			dataType,
			minLength,
			maxLength,
            minValue,
            maxValue,
            integer,
            specificValues,
            dbcheck: {
                statement,
                vars,
                exclusion
            }
		}
	}
	*/
	let success = true;
	let errorMsg = '';
	for (let i of inputs) {
		if (i.input === null) {
			success = false;
			errorMsg = `${i.name} is null`;
			break;
		}
        if (i.requirements.dataType === 'date') {
            if (!(i.input instanceof Date)) {
                success = false;
                errorMsg = `${i.name} does not match expected data type; expected ${i.requirements.dataType}, received ${typeof i.input}`;
                break;
            }
        }
        else {
            if (typeof i.input !== i.requirements.dataType) {
                success = false;
                errorMsg = `${i.name} does not match expected data type; expected ${i.requirements.dataType}, received ${typeof i.input}`;
                break;
            }
        }

        if (i.requirements.dataType === 'number') {
            if (!Number.isFinite(i.input)) {
                success = false;
                errorMsg = `${i.name} is not a safe number; expected a finite number, received ${i.input}`;
                break;
            }
            if ((i.input > i.requirements.maxValue) || (i.input < i.requirements.minValue)) {
                success = false;
                errorMsg = `${i.name} does not match expected value; expected at least ${i.requirements.minValue} and at most ${i.requirements.maxValue}, received ${i.input}`;
                break;
            }
            if (i.requirements.integer) {
                if (!Number.isInteger(i.input)) {
                    success = false;
                    errorMsg = `${i.name} is not an integer; received ${i.input}`;
                    break;
                }
            }
        }
        else if (i.requirements.dataType === 'string') {
            if ((i.input.trim().length > i.requirements.maxLength) || (i.input.trim().length < i.requirements.minLength)) {
                success = false;
                errorMsg = `${i.name} does not match expected length; expected at least ${i.requirements.minLength} and at most ${i.requirements.maxLength}, received ${i.input.length}`;
                break;
            }
            if (i.requirements.specificValues) {
                if (!i.requirements.specificValues.includes(i.input.trim())) {
                    success = false;
                    errorMsg = `${i.name} does not match expected values; expected one of ${i.requirements.specificValues}, received ${i.input}`;
                }
            }
        }
        else if (i.requirements.dataType === 'date') {
            if (Number.isNaN(i.input.getTime())) {
                success = false;
                errorMsg = `${i.name} is not a valid date; received ${i.input}`;
                break;
            }
            if ((i.input > i.requirements.maxValue) || (i.input < i.requirements.minValue)) {
                success = false;
                errorMsg = `${i.name} does not match expected value; expected at least ${i.requirements.minValue} and at most ${i.requirements.maxValue}, received ${i.input}`;
                break;
            }
        }

        if (i.requirements.dbCheck) {
            if (i.input !== i.requirements.dbCheck.exclusion) {
                let results;

                try {
                    const selection = env.blitz.prepare(i.requirements.dbCheck.statement).bind(...i.requirements.vars);
                    results = await selection.first();
                }
                catch (error) {
                    await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${i.requirements.dbCheck.statement}`, error);
                    return {
                        success: false,
                        response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                    }
                }
                
                if (!results) {
                    success = false;
                    errorMsg = `Derived car not found for iteration ${i.input}`;
                    break;
                }
            }
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

    try {
        const ip = request.headers.get('cf-connecting-ip');
        if (!ip) {
            allow = false;
            await log('warn', pathname, request, 'No IP address found');
            response = await buildResponse('There was an unexpected error.', 403, normalHeader);
            throw new Error();
        }

        const ipBanned = await checkIPBanned(pathname, request, ip, env);
        if (!ipBanned.success) {
            allow = false;
            response = await buildResponse('There was an unexpected error.', 500, normalHeader);
            throw new Error();
        }
        if (ipBanned.banned) {
            allow = false;
            response = await buildResponse('You have been blocked from making further attempts.', 429, normalHeader);
            throw new Error();
        }

        const { success } = await env.ratelimiter.limit({ key: ip });
        if (!success) {
            allow = false;
            response = await banIP(pathname, request, ip, env);
            throw new Error();
        }
		
		throw new Error();
    }
    catch {
        return {
            allow: allow,
            response: response
        }
    }
}

const updateLastLogin = async (pathname, request, env, enteredUsername, sessionToken, rememberMe) => {
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

    const response = await buildResponse('Logging in...', 200, normalHeader);
	let time;
	if (rememberMe) time = 604800;
	else time = 86400;
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=${time}; Path=/; SameSite=None; Secure;`);

	return response;
}

const checkIPBanned = async (pathname, request, ip, env) => {
	let result;
    const statement = 'SELECT ip FROM ipbans';
	try {
		const query = env.blitz.prepare(statement);
		result = await query.all();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false
		}
	}

	const banList = result.results;
	for (let i of banList) {
        if (!Object.hasOwn(i, 'ip')) {
            await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch ip from ip ban records; statement: ${statement}`);
            return {
                success: false
            }
        }
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
		banned: false,
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
		result = await query.first();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (!result) {
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
		result = await query.first();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

    if (!result) {
        await log('warn', pathname, request, `No results were found during password fetch when executing the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
    }

    const expectedFields = ['password_hash', 'password_salt']

    for (let i of expectedFields) {
		if (!Object.hasOwn(result, i)) {
			await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch password data for user ${username}; statement: ${statement}`);
            return {
                allow: false,
                response: await buildResponse('There was an unexpected error.', 500, normalHeader)
            }
		}
	}
	
	const trueHash = result['password_hash'];
	const trueSalt = Buffer.from(result['password_salt'], 'hex');

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
		result = await query.first();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

    if (!result) {
        await log('warn', pathname, request, `D1 query returned no data when attempting to fetch active data for user ${username}; statement: ${statement}`);
        return {
            allow: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }

	if (!Object.hasOwn(result, 'active')) {
		await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch active data for user ${username}; statement: ${statement}`);
        return {
            allow: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
	}

	if (result.active === 1) {
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

const addNewSessionToken = async (sessionToken, env, enteredUsername, pathname, request, rememberMe) => {
	const userID = await fetchUserDataFromUsername(request, pathname, env, enteredUsername);
    if (!userID.success) {
        return {
            allow: false,
            response: userID.response
        }
    }

	const date = new Date();
	if (rememberMe) date.setDate(date.getDate() + 7);
	else date.setDate(date.getDate() + 1);
	const expiry = date.toISOString();

	const tokenSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const hashedToken = hash(sessionToken, tokenSalt);
	const tokenHash = hashedToken.hash;

	const insertionStatement = 'INSERT INTO sessiontokens (session_token_hash, userid, expiration_date) VALUES (?, ?, ?);';
	try {
		const insertion = env.blitz.prepare(insertionStatement).bind(tokenHash, userID.response.userid, expiry);
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

const updatePassword = async (userid, env, newPassword, pathname, request) => {
	const hashAndSalt = hash(newPassword);
	const statement = 'UPDATE users SET password_hash = ?, password_salt = ?, force_password_change = ? WHERE userid = ?';

	try {
		const query = env.blitz.prepare(statement).bind(hashAndSalt.hash, hashAndSalt.salt, 0, userid);
		await query.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	await log('info', pathname, request, `Password successfully updated for user ${userid}`);
	return {
		success: true,
		response: await buildResponse('Successfully changed password.', 200, normalHeader)
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
		results = await query.first();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (!results) {
		return {
			allow: false,
			response: await buildResponse('You must be logged in to view this page.', 401, normalHeader)
		}
	}
	else {
        if (!Object.hasOwn(results, 'session_token_hash')) {
            await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch session token data for (hashed) token ${attemptedHash}; statement: ${statement}`);
            return {
                allow: false,
                response: await buildResponse('There was an unexpected error.', 500, normalHeader)
            }
        }
		if (compare(attemptedHash, results['session_token_hash'])) {
            if (!Object.hasOwn(results, 'userid')) {
                await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch session token data for (hashed) token ${attemptedHash}; statement: ${statement}`);
                return {
                    allow: false,
                    response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                }
            }
            else {
                return {
                    allow: true,
                    userid: results.userid
                }
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
    // clear the session token on the browser too
    if (!userid.allow) {
        const response = userid.response;
        response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`);
        return {
            allow: false,
            response: response
        }
    }
    return {
        allow: true,
        userid: userid.userid,
        sessionToken: sessionToken
    }
}

const fetchUserDataFromUserID = async (request, pathname, env, userid) => {
	const statement = 'SELECT name, username, last_login, iterations FROM users WHERE userid = ?';
	let results;

	try {
		const selection = env.blitz.prepare(statement).bind(userid);
		results = await selection.first();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
            success: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
	}
	
	if (!results) {
		await log('warn', pathname, request, `User record not found for userid ${userid}; expected name, username, last_login, iterations, received none`);
		return {
            success: false,
            response: await buildResponse('User not found.', 404, normalHeader)
        }
	}
	else {
        const expectedFields = ['name', 'username', 'last_login', 'iterations'];
        for (let i of expectedFields) {
			if (!Object.hasOwn(results, i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch user data for user id ${userid}; statement: ${statement}`);
                return {
                    success: false,
                    response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                }
			}
		}

		results.lastLogin = results['last_login'];
		delete results['last_login'];
        results.userID = userid;

        return {
            success: true,
            response: results
        }
	}
}

const fetchUserDataFromUsername = async (request, pathname, env, username) => {
    const statement = 'SELECT name, userid, last_login, iterations FROM users WHERE username = ?';
    let results;

    try {
        const selection = env.blitz.prepare(statement).bind(username);
        results = await selection.first();
    }
    catch (error) {
        await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
        return {
            success: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }
    
    if (!results) {
        await log('warn', pathname, request, `User record not found for username ${username}; expected name, userid, last_login, iterations, received none`);
        return {
            success: false,
            response: await buildResponse('User not found.', 404, normalHeader)
        }
    }
    else {
        const expectedFields = ['name', 'userid', 'last_login', 'iterations'];
        for (let i of expectedFields) {
			if (!Object.hasOwn(results, i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch user data for username ${username}; statement: ${statement}`);
                return {
                    success: false,
                    response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                }
			}
		}

        results.lastLogin = results['last_login'];
        delete results['last_login'];
        results.username = username;

        return {
            success: true,
            response: results
        }
    }
}

const fetchFromR2 = async (request, pathname, env, filepath, contentHeader, disposition) => {
    let file;

    try {
        file = await env.blitzr2.get(filepath);
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

        const placeholderFetch = await fetchFromR2(request, pathname, env, `assets/profiles/placeholder.jpg`, 'image/jpeg');
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
            finalPayload = await file.blob();
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
            response: await buildResponse('File successfully fetched', 200, contentHeader, 'BLOB', finalPayload, `inline; filename=${disposition}`)
        }
    }
}

const pullCarMetaDataWithIterationNumber = async (iterationNumber, env, pathname, request, findDerivations) => {
	let data;
	let response;
	let success = true;

	try {
		const carStatement = 'SELECT creatorid, scrutineerid, carid, derived_carid, car_name, iteration, date_created, frontal_area, drag_coefficient, drag_force, changelog, additional_notes FROM cars WHERE iteration = ?';
		const expectedCarFields = ['creatorid', 'scrutineerid', 'carid', 'derived_carid', 'car_name', 'iteration', 'date_created', 'frontal_area', 'drag_coefficient', 'drag_force', 'changelog', 'additional_notes'];
		try {
			const query = env.blitz.prepare(carStatement).bind(iterationNumber);
			data = await query.first();
		}
		catch (error) {
			await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${carStatement}`, error);
			success = false;
			response = await buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		if (!data) {
			await log('warn', pathname, request, `D1 query returned no data when attempting to fetch metadata for iteration ${iterationNumber}; statement: ${carStatement}`);
			success = false;
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			throw new Error();
		}

		for (let i of expectedCarFields) {
			if (!Object.hasOwn(data, i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch metadata for iteration ${iterationNumber}; statement: ${carStatement}`);
				response = await buildResponse('There was an unexpected error.', 500, normalHeader);
				success = false;
				throw new Error();
			}
		}

		const creatorData = await fetchUserDataFromUserID(request, pathname, env, data.creatorid);
		if (!creatorData.success) {
			success = false;
			response = creatorData.response;
			throw new Error();
		}
		const scrutineerData = await fetchUserDataFromUserID(request, pathname, env, data.scrutineerid);
		if (!scrutineerData.success) {
			success = false;
			response = scrutineerData.response;
			throw new Error();
		}

		data.creatorName = creatorData.response.name;
		data.creatorUsername = creatorData.response.username;
		data.scrutineerName = scrutineerData.response.name;
		data.changelog = data.changelog.split('[BRK;]');

		if ((data['derived_carid'] !== null) && (findDerivations)) {
			const derivedCar = await pullCarMetaDataWithCarID(data['derived_carid'], env, pathname, request, false);
			if (!derivedCar.success) {
				await log('warn', pathname, request, `Fetching car metadata for derived car id ${data['derived_carid']} failed; see earlier error messages for more information`);
				success = false;
				response = derivedCar.response;
				throw new Error();
			}

			data.derivedCarName = derivedCar.data['car_name'];
			data.derivedCarIteration = derivedCar.data.iteration;
		}
		
		throw new Error();
	}
	catch {
		return {
			success: success,
			response: response,
			data: data
		}
	}
}

const pullCarMetaDataWithCarID = async (carid, env, pathname, request, findDerivations) => {
	let data;
	let response;
	let success = true;

	try {
		const carStatement = 'SELECT creatorid, scrutineerid, carid, derived_carid, car_name, iteration, date_created, frontal_area, drag_coefficient, drag_force, changelog, additional_notes FROM cars WHERE carid = ?';
		const expectedCarFields = ['creatorid', 'scrutineerid', 'carid', 'derived_carid', 'car_name', 'iteration', 'date_created', 'frontal_area', 'drag_coefficient', 'drag_force', 'changelog', 'additional_notes'];
		try {
			const query = env.blitz.prepare(carStatement).bind(carid);
			data = await query.first();
		}
		catch (error) {
			await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${carStatement}`, error);
			success = false;
			response = await buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		if (!data) {
			await log('warn', pathname, request, `D1 query returned no data when attempting to fetch metadata for car id ${carid}; statement: ${carStatement}`);
			success = false;
			response = await buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		for (let i of expectedCarFields) {
			if (!Object.hasOwn(data, i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch metadata for car id ${carid}; statement: ${carStatement}`);
				response = await buildResponse('There was an unexpected error.', 500, normalHeader);
				success = false;
				throw new Error();
			}
		}

		const creatorData = await fetchUserDataFromUserID(request, pathname, env, data.creatorid);
		if (!creatorData.success) {
			success = false;
			response = creatorData.response;
			throw new Error();
		}
		const scrutineerData = await fetchUserDataFromUserID(request, pathname, env, data.scrutineerid);
		if (!scrutineerData.success) {
			success = false;
			response = scrutineerData.response;
			throw new Error();
		}

		data.creatorName = creatorData.response.name;
		data.creatorUsername = creatorData.response.username;
		data.scrutineerName = scrutineerData.response.name;
		data.changelog = data.changelog.split('[BRK;]');

		if ((data['derived_carid'] !== null) && (findDerivations)) {
			const derivedCar = await pullCarMetaDataWithCarID(data['derived_carid'], env, pathname, request, false);
			if (!derivedCar.success) {
				await log('warn', pathname, request, `Fetching car metadata for derived car id ${data['derived_carid']} failed; see earlier error messages for more information`);
				success = false;
				response = derivedCar.response;
				throw new Error();
			}

			data.derivedCarName = derivedCar.data['car_name'];
			data.derivedCarIteration = derivedCar.data.iteration;
		}
		
		throw new Error();
	}
	catch {
		return {
			success: success,
			response: response,
			data: data
		}
	}
}

const identifyMaxIteration = async (request, pathname, env) => {
	const statement = 'SELECT max(iteration) as max_iteration FROM cars';
	let selection;
	try {
		selection = await env.blitz.prepare(statement).first();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (selection === null) {
		await log('warn', pathname, request, `Maximum iteration could not be found when executing the statement: ${statement}; expected an integer, received null`);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error', 500, normalHeader)
		}
	}
	else {
		return {
			success: true,
			response: selection['max_iteration']
		}
	}
}

const uploadCarMetadata = async (request, pathname, env, carArray) => {
	const statement = 'INSERT INTO cars (creatorid, scrutineerid, carid, derived_carid, car_name, iteration, date_created, frontal_area, drag_coefficient, drag_force, changelog, additional_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
	
	try {
		const query = env.blitz.prepare(statement).bind(...carArray);
		await query.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}
	return {
		success: true,
		response: await buildResponse('Upload successful.', 200, normalHeader, { carid: carArray[2] })
	}
}

const pullCarFile = async (iterationNumber, env, pathname, request) => {
	const carid = await pullCarMetaDataWithIterationNumber(iterationNumber, env, pathname, request, false);
	if (!carid.success) {
		return {
			success: false,
			response: carid.response
		}
	}
	
	let potentialFiles;
	try {
		potentialFiles = await env.blitzr2.list({ prefix: `assets/${pathname.split('/').at(-1)}/${carid.data.carid}` });
	}
	catch (error) {
		await log('error', pathname, request, `R2 query failed when attempting to fetch list of car model files for iteration ${iterationNumber}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (potentialFiles.objects.length === 0) {
		await log('warn', pathname, request, `No car model files were found for iteration ${iterationNumber}.`);
		return {
			success: false,
			response: await buildResponse('Car model file not found.', 404, normalHeader)
		}
	}

    const fileName = potentialFiles.objects[0].key;
    let header;
    switch (fileName.split('.')[1]) {
        case 'png':
            header = 'image/png';
            break;
        case 'glb':
            header = 'model/gltf-binary';
            break;
        default:
            header = 'application/octet-stream';
    }

	const fetch = await fetchFromR2(request, pathname, env, potentialFiles.objects[0].key, header, fileName);
	if (!fetch.success) {
		return {
			success: false,
			response: fetch.response,
		}
	}
	else {
		return {
			success: true,
			response: fetch.response,
		}
	}
}

const uploadCarFile = async (carid, env, pathname, request, type, file) => {
    try {
        const object = await env.blitzr2.put(`assets/${pathname.split('/').at(-1)}/${carid}.${type.toLowerCase()}`, file);
        if (object === null) throw new Error('There was no error stack provided; object returned was null - the file already exists.');
        return await buildResponse('File upload successful.', 200, normalHeader, { carid: carid });
    }
    catch (error) {
        await log('error', pathname, request, `R2 query failed when attempting to upload car file of type ${type} with car id ${carid}`, error);
        return await buildResponse('There was an unexpected error.', 500, normalHeader);
    }
}

const deleteSessionToken = async (sessionToken, env, pathname, request) => {
	const theSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const hashed = hash(sessionToken, theSalt).hash;

	const statement = 'DELETE FROM sessiontokens WHERE session_token_hash = ?';
	try {
		const query = env.blitz.prepare(statement).bind(hashed);
		await query.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	const response = await buildResponse('Logged out successfully.', 200, normalHeader);
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`);
	return {
		success: true,
		response: response
	}
}

const deleteAllSessionTokens = async (userid, env, pathname, request, sessionToken) => {
	const statement = 'DELETE FROM sessiontokens WHERE userid = ?';
	try {
		const query = env.blitz.prepare(statement).bind(userid);
		await query.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	const response = await buildResponse('Logged out of all devices successfully.', 200, normalHeader);
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`);
	return {
		success: true,
		response: response
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
    pullCarMetaDataWithIterationNumber,
    pullCarMetaDataWithCarID,
    uploadCarMetadata,
    identifyMaxIteration,
    pullCarFile,
    parseRequestBlob,
    uploadCarFile,
    deleteSessionToken,
    deleteAllSessionTokens,
	updatePassword
};