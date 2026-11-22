const crypto = require('node:crypto');
const normalHeader = 'application/json; charset=UTF-8';
const { UAParser } = require('ua-parser-js');

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
	else return crypto.subtle.timingSafeEqual(bufferA, bufferB);
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
const buildResponse = (message, status, contentType, object, blob, disposition) => {
	let p;
	if (Array.isArray(object)) p = { array: object };
	else p = object;

    let finalObject = {...{ message: `${message} Timestamp: ${new Date().toISOString()}` }, ...p}
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
const checkRequest = (pathname, request, expectedMethods, expectedContentHeaders) => {
	let response;
	let success = true;

    try {
        if (!expectedMethods.includes(request.method)) {
            log('warn', pathname, request, `Incorrect request method; expected ${expectedMethods}, received ${request.method}`);
            response = buildResponse('There was an unexpected error.', 405, normalHeader);
            success = false;
            throw new Error();
        }

        if (expectedContentHeaders) {
            const requestContentHeader = request.headers.get('Content-Type');
            if (requestContentHeader === null) {
                log('warn', pathname, request, 'No content header received.');
                response = buildResponse('There was an unexpected error.', 415, normalHeader);
                success = false;
                throw new Error();
            }

            const requestContentHeaders = requestContentHeader.split(';');
            if (!expectedContentHeaders.includes(requestContentHeaders[0].toLowerCase())) {
                log('warn', pathname, request, `Required content header not found; expected ${expectedContentHeaders}, received ${requestContentHeaders}`);
                response = buildResponse('There was an unexpected error.', 415, normalHeader);
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
			log('warn', pathname, request, 'Malformed request body received; completely unparsable.', error);
			response = buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}

		if (json === null) {
			log('warn', pathname, request, 'Malformed request body received; request body is null.');
			response = buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}

		if (Array.isArray(json)) {
			log('warn', pathname, request, 'Malformed request body received; request body is an array.');
			response = buildResponse('There was an unexpected error.', 400, normalHeader);
			success = false;
			throw new Error();
		}
		
		for (let i of requiredFields) {
			if (!Object.hasOwn(json, i)) {
				log('warn', pathname, request, 'Malformed request body received; completely unparsable.');
				response = buildResponse('There was an unexpected error.', 400, normalHeader);
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
        log('error', pathname, request, 'Failed to perform blob() method on request', error);
        return {
            success: false,
            response: buildResponse('There was an unexpected error.', 400, normalHeader)
        }
    }

    if ((blob.size === 0) || (blob.size > maxSize)) {
        log('info', pathname, request, `Attempt to upload file with size ${blob.size} bytes blocked; exceeded maximum limit of ${maxSize} bytes`);
        return {
            success: false,
            response: buildResponse(`File uploaded exceeds maximum size of `, 400, normalHeader)
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
                    const selection = env.blitz.prepare(i.requirements.dbCheck.statement).bind(...i.requirements.dbCheck.vars);
                    results = await selection.first();
                }
                catch (error) {
                    log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${i.requirements.dbCheck.statement}`, error);
                    return {
                        success: false,
                        response: buildResponse('There was an unexpected error.', 500, normalHeader)
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
			checkUsername('67', env);
		}
		log('warn', pathname, request, errorMsg);
		const response = buildResponse('There was an unexpected error.', 400, normalHeader);
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

/**
 * Checks if the IP of the request is banned, and adds the IP to the banlist if it exceeds a rate limit.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {Env} env
 * @returns {{ allow: boolean, response: Response | undefined }}
 */
const handleIPBan = async (pathname, request, env) => {
	let allow = true;
	let response;

    try {
        const ip = request.headers.get('cf-connecting-ip');
        if (!ip) {
            allow = false;
            log('warn', pathname, request, 'No IP address found');
            response = buildResponse('There was an unexpected error.', 403, normalHeader);
            throw new Error();
        }

        const ipBanned = await checkIPBanned(pathname, request, ip, env);
        if (!ipBanned.success) {
            allow = false;
            response = buildResponse('There was an unexpected error.', 500, normalHeader);
            throw new Error();
        }
        if (ipBanned.banned) {
            allow = false;
            response = buildResponse('You have been blocked from making further attempts.', 429, normalHeader);
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

/**
 * Updates the last_login field of the user's record in the database.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {Env} env
 * @param {string} enteredUsername The username of the user who has just logged in.
 * @param {boolean} rememberMe Whether the user has opted to stay logged in for longer.
 * @returns {Response}
 */
const updateLastLogin = async (pathname, request, env, enteredUsername, sessionToken, rememberMe) => {
	const currentDate = (new Date()).toISOString();
	const statement = 'UPDATE users SET last_login = ? WHERE username = ?';

	try {
		const query = env.blitz.prepare(statement).bind(currentDate, enteredUsername);
		await query.run();
	}
	catch (error) {
		const deletion = deleteSessionTokenFromSessionToken(sessionToken, env, pathname, request);
		if (!deletion.success) {
			response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`);
		}

		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return buildResponse('There was an unexpected error.', 500, normalHeader);
	}

    const response = buildResponse('Logging in...', 200, normalHeader);
	let time;
	if (rememberMe) time = 604800;
	else time = 86400;
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=${time}; Path=/; SameSite=None; Secure; Partitioned;`);

	return response;
}

/**
 * Checks the ipbans table in the database for the IP passed into the function.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {string} ip The IP address of the user.
 * @param {Env} env
 * @returns {{ success: boolean, banned: boolean | undefined }}
 */
const checkIPBanned = async (pathname, request, ip, env) => {
	let result;
    const statement = 'SELECT ip FROM ipbans';
	try {
		const query = env.blitz.prepare(statement);
		result = await query.all();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false
		}
	}

	const banList = result.results;
	for (let i of banList) {
        if (!Object.hasOwn(i, 'ip')) {
            log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch ip from ip ban records; statement: ${statement}`);
            return {
                success: false
            }
        }
		if (i.ip === ip) {
			log('warn', pathname, request, 'Attempt from a banned IP address was blocked');
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

/**
 * Bans an IP address by adding them to the ipbans table in the database.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {string} ip The IP address of the user.
 * @param {Env} env
 * @returns {Response}
 */
const banIP = async (pathname, request, ip, env) => {
	const currentDate = new Date().toISOString();

	try {
		const statement = 'INSERT INTO ipbans (ip, date_banned) VALUES (?, ?);'
		const insertion = env.blitz.prepare(statement).bind(ip, currentDate);
		await insertion.run();
		log('info', pathname, request, `Successfully banned IP: ${ip}`);
		return buildResponse('You have been blocked from making further attempts.', 429, normalHeader);
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return buildResponse('There was an unexpected error.', 500, normalHeader);
	}
}

/**
 * Checks if a user exists by their username.
 * @param {string} username The user's username.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{ allow: boolean, response: Response | undefined }}
 */
const checkUsername = async (username, env, pathname, request) => {
	let result;
	const statement = 'SELECT username FROM users WHERE username = ?';

	try {
		const query = env.blitz.prepare(statement).bind(username);
		result = await query.first();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (!result) {
		const fakeHash = hash('676767676767').hash;
		compare(fakeHash, fakeHash);
		return {
			allow: false,
			response: buildResponse('Invalid username or password', 401, normalHeader)
		}
	}
	else {
		return {
			allow: true
		}
	}
}

/**
 * Checks if the entered password matches the password on file for that user, performing intermediary hashing.
 * @param {string} username The user's username.
 * @param {string} enteredPassword The password to be checked against the database record.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{ allow: boolean, response: Response | undefined }}
 */
const authenticate = async (username, enteredPassword, env, pathname, request) => {
	const statement = 'SELECT password_hash, password_salt FROM users WHERE username = ?';
	let result;

	try {
		const query = env.blitz.prepare(statement).bind(username.toLowerCase());
		result = await query.first();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

    if (!result) {
        log('warn', pathname, request, `No results were found during password fetch when executing the statement: ${statement}`, error);
		return {
			allow: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
    }

    const expectedFields = ['password_hash', 'password_salt']

    for (let i of expectedFields) {
		if (!Object.hasOwn(result, i)) {
			log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch password data for user ${username}; statement: ${statement}`);
            return {
                allow: false,
                response: buildResponse('There was an unexpected error.', 500, normalHeader)
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
			response: buildResponse('Invalid username or password', 401, normalHeader)
		}
	}
}

/**
 * Checks whether the account associated with the user trying to login is active or not.
 * @param {string} username The user's username.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{ allow: Boolean, response: Response | undefined }}
 */
const checkIfActive = async (username, env, pathname, request) => {
	const statement = 'SELECT active FROM users WHERE username = ?';
	let result;

	try {
		const query = env.blitz.prepare(statement).bind(username);
		result = await query.first();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

    if (!result) {
        log('warn', pathname, request, `D1 query returned no data when attempting to fetch active data for user ${username}; statement: ${statement}`);
        return {
            allow: false,
            response: buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }

	if (!Object.hasOwn(result, 'active')) {
		log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch active data for user ${username}; statement: ${statement}`);
        return {
            allow: false,
            response: buildResponse('There was an unexpected error.', 500, normalHeader)
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
			response: buildResponse('Your account has been disabled.', 403, normalHeader)
		}
	}
}

/**
 * Creates a database record for a new session token.
 * @param {Buffer} sessionToken The session token as a Buffer, generated from `crypto.randomUUID()`.
 * @param {Env} env
 * @param {string} enteredUsername The user's username.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {boolean} rememberMe Whether the user has opted in to stay logged in for longer.
 * @returns {{ success: boolean, response: Response | undefined }}
 */
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
	const useragent = new UAParser(request.headers.get('User-Agent')).getResult();
	const uuid = crypto.randomUUID();

	const insertionStatement = 'INSERT INTO sessiontokens (token_id, session_token_hash, userid, expiration_date, browser, ip, geolocation, last_accessed) VALUES (?, ?, ?, ?, ?, ?, ?, ?);';
	try {
		const insertion = env.blitz.prepare(insertionStatement).bind(uuid, tokenHash, userID.response.userid, expiry, `${useragent?.browser?.toString() || 'Unknown browser'} on ${useragent?.device?.toString() || 'Unknown device'} running ${useragent?.os?.toString() || 'Unknown OS'}`, `${request.headers.get('cf-connecting-ip')}`, `${request.cf.city}, ${request.cf.country}`, `${new Date().toISOString()}`);
		await insertion.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${insertionStatement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	log('info', pathname, request, 'Session token successfully generated');
	return {
		success: true
	}
}

/**
 * Updates the user's password in the database. (Preview)
 * @param {string} userid The user ID associated with the account.
 * @param {Env} env
 * @param {string} newPassword The new password to be associated with the account.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{ success: boolean, response: Response }}
 */
const updatePassword = async (userid, env, newPassword, pathname, request) => {
	const hashAndSalt = hash(newPassword);
	const statement = 'UPDATE users SET password_hash = ?, password_salt = ?, force_password_change = ? WHERE userid = ?';

	try {
		const query = env.blitz.prepare(statement).bind(hashAndSalt.hash, hashAndSalt.salt, 0, userid);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	log('info', pathname, request, `Password successfully updated for user ${userid}`);
	return {
		success: true,
		response: buildResponse('Successfully changed password.', 200, normalHeader)
	}
}

/**
 * Checks whether the session token sent by the client exists, and returns the user's `userid` and the token's `tokenid`..
 * @param {string} sessionToken The session token as a string, taken from the cookie.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{ allow: boolean, response: Response | undefined, userid: string, tokenid: string }}
 */
const checkSessionToken = async (sessionToken, env, pathname, request) => {
	const theSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const attemptedHash = hash(sessionToken, theSalt).hash;
	const currentDate = (new Date()).toISOString();

	const statement = 'SELECT session_token_hash, userid, token_id FROM sessiontokens WHERE session_token_hash = ? AND expiration_date > ?';
	let results;
	try {
		const query = env.blitz.prepare(statement).bind(attemptedHash, currentDate);
		results = await query.first();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			allow: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (!results) {
		return {
			allow: false,
			response: buildResponse('You must be logged in to view this page.', 401, normalHeader)
		}
	}
	else {
        if (!Object.hasOwn(results, 'session_token_hash')) {
            log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch session token data for (hashed) token ${attemptedHash}; statement: ${statement}`);
            return {
                allow: false,
                response: buildResponse('There was an unexpected error.', 500, normalHeader)
            }
        }
		if (compare(attemptedHash, results['session_token_hash'])) {
            if (!Object.hasOwn(results, 'userid') || !Object.hasOwn(results, 'token_id')) {
                log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch session token data for (hashed) token ${attemptedHash}; statement: ${statement}`);
                return {
                    allow: false,
                    response: buildResponse('There was an unexpected error.', 500, normalHeader)
                }
            }
            else {
                return {
                    allow: true,
                    userid: results.userid,
					tokenid: results.token_id
                }
            }
		}
		else {
			return {
				allow: false,
				response: buildResponse('You must be logged in to view this page.', 401, normalHeader)
			}
		}
	}
}

/**
 * Parses the cookie header into a comprehensible list.
 * @param {string} cookieHeader The cookie header sent by the client.
 * @returns {Array} An array of cookies.
 */
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

/**
 * Checks whether there is a valid, authenticated session for this client and account.
 * @param {Request} request The Request object associated with it.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Env} env
 * @returns {{ allow: boolean, response: Response | undefined, userid: string | undefined, sessionToken: string | undefined, tokenid: string | undefined }} Whether to allow the user to pass, with the `sessionToken` found and the `userid` of the user if allowed, or with a sample `Response` if not.
 */
const checkSession = async (request, pathname, env) => {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies['session_token'];

    if (!sessionToken) {
        return {
            allow: false,
            response: buildResponse('You must be logged in to view this page.', 401, normalHeader)
        }
    }

    const userid = await checkSessionToken(sessionToken, env, pathname, request);
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
        sessionToken: sessionToken,
		tokenid: userid.tokenid
    }
}

/**
 * An ISO 8601 formatted date-time string (e.g., "2026-11-16T18:26:00.000Z").
 * @typedef {string & { readonly __brand: 'ISODateString' }} ISODateString
 */

/**
 * A boolean expressed as a number. 0 corresponds to `false`, whereas 1 corresponds to `true`.
 * @typedef {string & { readonly __brand: 'BoolNumber' }} BoolNumber
 */

/**
 * Fetches all of the user's personal and account data (except password details) using the `userid`.
 * @param {Request} request The Request object associated with it.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Env} env
 * @param {string} userid The user ID associated with the account.
 * @returns {{ success: boolean, response: Response | { name: string, username: string, last_login: ISODateString, iterations: number, force_password_change: BoolNumber, scrutineers: number } }} Whether the fetch has succeeded, along with the user data in a JavaScript Object if it did, and a sample Response if not.
 */
const fetchUserDataFromUserID = async (request, pathname, env, userid) => {
	const statement = 'SELECT name, username, last_login, iterations, force_password_change, scrutineers FROM users WHERE userid = ?';
	let results;

	try {
		const selection = env.blitz.prepare(statement).bind(userid);
		results = await selection.first();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
            success: false,
            response: buildResponse('There was an unexpected error.', 500, normalHeader)
        }
	}
	
	if (!results) {
		log('warn', pathname, request, `User record not found for userid ${userid}; expected name, username, last_login, iterations, force_password_change, received none`);
		return {
            success: false,
            response: buildResponse('User not found.', 404, normalHeader)
        }
	}
	else {
        const expectedFields = ['name', 'username', 'last_login', 'iterations', 'force_password_change'];
        for (let i of expectedFields) {
			if (!Object.hasOwn(results, i)) {
				log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch user data for user id ${userid}; statement: ${statement}`);
                return {
                    success: false,
                    response: buildResponse('There was an unexpected error.', 500, normalHeader)
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

/**
 * Fetches all of the user's personal and account data (except password details) using the `username`.
 * @param {Request} request The Request object associated with it.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Env} env
 * @param {string} username The user's username.
 * @returns {{ success: boolean, response: Response | { name: string, userid: string, last_login: ISODateString, iterations: number, force_password_change: BoolNumber, scrutineers: number } }} Whether the fetch has succeeded, along with the user data in a JavaScript Object if it did, and a sample Response if not.
 */
const fetchUserDataFromUsername = async (request, pathname, env, username) => {
    const statement = 'SELECT name, userid, last_login, iterations, force_password_change, scrutineers FROM users WHERE username = ?';
    let results;

    try {
        const selection = env.blitz.prepare(statement).bind(username);
        results = await selection.first();
    }
    catch (error) {
        log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
        return {
            success: false,
            response: buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }
    
    if (!results) {
        log('warn', pathname, request, `User record not found for username ${username}; expected name, userid, last_login, iterations, force_password_change, received none`);
        return {
            success: false,
            response: buildResponse('User not found.', 404, normalHeader)
        }
    }
    else {
        const expectedFields = ['name', 'userid', 'last_login', 'iterations', 'force_password_change'];
        for (let i of expectedFields) {
			if (!Object.hasOwn(results, i)) {
				log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch user data for username ${username}; statement: ${statement}`);
                return {
                    success: false,
                    response: buildResponse('There was an unexpected error.', 500, normalHeader)
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

/**
 * Fetches a file from R2, with built-in null-handling by sending a placeholder image.
 * @param {Request} request The Request object associated with it.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Env} env
 * @param {string} filepath The location of the file in the R2 bucket.
 * @param {string} contentHeader The value of the 'Content-Type' HTTP header to be sent, varying based on the file type.
 * @param {string} disposition The filename to be sent within the 'Content-Disposition' header of a successful HTTP response.
 * @returns {{ success: boolean, response: Response }} Whether the fetch was successful, along with a Response with the data (or placeholder data) if it was, and a sample error Response if it wasn't.
 */
const fetchFromR2 = async (request, pathname, env, filepath, contentHeader, disposition) => {
    let file;

    try {
        file = await env.blitzr2.get(filepath);
    }
    catch (error) {
        log('error', pathname, request, `R2 query failed when attempting to fetch file at: ${filepath}`, error);
        return {
            success: false,
            response: buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }

    if (file === null) {
        log('warn', pathname, request, `File not found at path: ${filepath}; sending placeholder image`);

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
            log('error', pathname, request, `Failed to perform blob() method on file at: ${filepath}`, error);
            return {
                success: false,
                response: buildResponse('There was an unexpected error.', 500, normalHeader)
            }
        }

        return {
            success: true,
            response: buildResponse('File successfully fetched', 200, contentHeader, 'BLOB', finalPayload, `inline; filename=${disposition}`)
        }
    }
}

/**
 * Fetches the metadata of a car via its iteration number.
 * @param {number} iterationNumber The iteration number of the car.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {boolean} findDerivations Whether or not to repeat this process for the derived car of this car.
 * @returns {{ success: boolean, response: Response | undefined, data: { creatorid: string, scrutineerid: string, carid: string, derived_carid: string, car_name: string, iteration: number, date_created: ISODateString, frontal_area: number, drag_coefficient: number, drag_force: number, changelog: Array<string>, additional_notes: string, creatorName: string, creatorUsername: string, scrutineerName: string, derivedCarName: string, derivedCarIteration: number } | undefined }} Whether or not the fetch succeeded, with a JavaScript Object of all the car's metadata if it did, and a sample error Response if it didn't.
 */
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
			log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${carStatement}`, error);
			success = false;
			response = buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		if (!data) {
			log('warn', pathname, request, `D1 query returned no data when attempting to fetch metadata for iteration ${iterationNumber}; statement: ${carStatement}`);
			success = false;
			response = buildResponse('There was an unexpected error.', 400, normalHeader);
			throw new Error();
		}

		for (let i of expectedCarFields) {
			if (!Object.hasOwn(data, i)) {
				log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch metadata for iteration ${iterationNumber}; statement: ${carStatement}`);
				response = buildResponse('There was an unexpected error.', 500, normalHeader);
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
				log('warn', pathname, request, `Fetching car metadata for derived car id ${data['derived_carid']} failed; see earlier error messages for more information`);
				success = false;
				response = derivedCar.response;
				throw new Error();
			}

			data.derivedCarName = derivedCar.data['car_name'];
			data.derivedCarIteration = derivedCar.data.iteration;
		}
		else {
			data.derivedCarName = '67';
			data.derivedCarIteration = '67';
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

/**
 * Fetches the metadata of a car via its car ID.
 * @param {number} carid The car ID of the car.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {boolean} findDerivations Whether or not to repeat this process for the derived car of this car.
 * @returns {{ success: boolean, response: Response | undefined, data: { creatorid: string, scrutineerid: string, carid: string, derived_carid: string, car_name: string, iteration: number, date_created: ISODateString, frontal_area: number, drag_coefficient: number, drag_force: number, changelog: Array<string>, additional_notes: string, creatorName: string, creatorUsername: string, scrutineerName: string, derivedCarName: string, derivedCarIteration: number } | undefined }} Whether or not the fetch succeeded, with a JavaScript Object of all the car's metadata if it did, and a sample error Response if it didn't.
 */
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
			log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${carStatement}`, error);
			success = false;
			response = buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		if (!data) {
			log('warn', pathname, request, `D1 query returned no data when attempting to fetch metadata for car id ${carid}; statement: ${carStatement}`);
			success = false;
			response = buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		for (let i of expectedCarFields) {
			if (!Object.hasOwn(data, i)) {
				log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch metadata for car id ${carid}; statement: ${carStatement}`);
				response = buildResponse('There was an unexpected error.', 500, normalHeader);
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
				log('warn', pathname, request, `Fetching car metadata for derived car id ${data['derived_carid']} failed; see earlier error messages for more information`);
				success = false;
				response = derivedCar.response;
				throw new Error();
			}

			data.derivedCarName = derivedCar.data['car_name'];
			data.derivedCarIteration = derivedCar.data.iteration;
		}
		else {
			data.derivedCarName = '67';
			data.derivedCarIteration = '67';
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

/**
 * Finds the current maximum car iteration in the database.
 * @param {Request} request The Request object associated with it.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Env} env
 * @returns {{ success: boolean, response: Response | number }} Whether the request succeeded, with the maximum iteration number if it did and a sample Error response if it didn't.
 */
const identifyMaxIteration = async (request, pathname, env) => {
	const statement = 'SELECT max(iteration) as max_iteration FROM cars';
	let selection;
	try {
		selection = await env.blitz.prepare(statement).first();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (selection === null) {
		log('warn', pathname, request, `Maximum iteration could not be found when executing the statement: ${statement}; expected an integer, received null`);
		return {
			success: false,
			response: buildResponse('There was an unexpected error', 500, normalHeader)
		}
	}
	else {
		return {
			success: true,
			response: selection['max_iteration']
		}
	}
}

/**
 * An Array with every metadata field required each corresponding to the car.
 * @typedef {[creatorid: string, scrutineerid: string, carid: string, derived_carid: string, car_name: string, iteration: number, date_created: ISODateString, frontal_area: number, drag_coefficient: number, drag_force: number, changelog: string, additional_notes: string]} carArray
 */

/**
 * Uploads a new car's metadata into the database.
 * @param {Request} request The Request object associated with it.
 * @param {string} pathname The API endpoint called by the client.
 * @param {Env} env
 * @param {carArray} carArray An Array with every metadata field required each corresponding to the car.
 * @returns { success: boolean, response: Response } Whether the upload was successful and the appropriate Response for it.
 */
const uploadCarMetadata = async (request, pathname, env, carArray) => {
	const statement = 'INSERT INTO cars (creatorid, scrutineerid, carid, derived_carid, car_name, iteration, date_created, frontal_area, drag_coefficient, drag_force, changelog, additional_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
	const iterationUpdateStatement = 'UPDATE users SET iterations = iterations + 1 WHERE userid = ?';
	const scrutineerUpdateStatement = 'UPDATE users SET scrutineers = scrutineers + 1 WHERE userid = ?';

	try {
		const query = env.blitz.prepare(statement).bind(...carArray);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	try {
		const query = env.blitz.prepare(iterationUpdateStatement).bind(carArray[0]);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	try {
		const query = env.blitz.prepare(scrutineerUpdateStatement).bind(carArray[1]);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	return {
		success: true,
		response: buildResponse('Upload successful.', 200, normalHeader, { carid: carArray[2] })
	}
}

/**
 * Fetches a file for a car via its iteration number using the API pathname to identify the type of file required.
 * @param {number} iterationNumber The car's iteration number.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{ success: boolean, response: Response}} Whether the fetch succeeded, with the binary blob in a Response if it did, and a sample error Response if it didn't.
 */
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
		log('error', pathname, request, `R2 query failed when attempting to fetch list of car model files for iteration ${iterationNumber}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (potentialFiles.objects.length === 0) {
		log('warn', pathname, request, `No car model files were found for iteration ${iterationNumber}.`);
		return {
			success: false,
			response: buildResponse('Car model file not found.', 404, normalHeader)
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

/**
 * Uploads a new file corresponding to a specific car, with built-in security to ensure another user cannot edit the car of another user.
 * @param {string} carid The car ID of the car.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {'f3d' | 'previews' | 'planes' | 'iso'} type The type of file it is.
 * @param {Blob} file The file blob to be uploaded.
 * @param {string} userid The user ID of the user attempting to upload this car file.
 * @returns {Response} The appropriate Response object based on whether the upload was successful or not.
 */

const uploadCarFile = async (carid, env, pathname, request, type, file, userid) => {
	const carData = await pullCarMetaDataWithCarID(carid, env, pathname, request, false);
	if (!carData.success) return carData.response;
	else {
		if (carData.data.creatorid === userid) {
			try {
				const object = await env.blitzr2.put(`assets/${pathname.split('/').at(-1)}/${carid}.${type.toLowerCase()}`, file);
				if (object === null) throw new Error('There was no error stack provided; object returned was null - the file already exists.');
				return buildResponse('File upload successful.', 200, normalHeader, { carid: carid });
			}
			catch (error) {
				log('error', pathname, request, `R2 query failed when attempting to upload car file of type ${type} with car id ${carid}`, error);
				return buildResponse('There was an unexpected error.', 500, normalHeader);
			}
		}
		else return buildResponse('You must be logged in to view this page.', 401, normalHeader);
	}
}

/**
 * Deletes a session token from the database and from the client's cookies using the token itself.
 * @param {string} sessionToken The session token as a string, taken from the cookie.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{success: boolean, response: Response}} Whether the deletion succeeded, with an appropriate Response object (with the session token removed if successful).
 */
const deleteSessionTokenFromSessionToken = async (sessionToken, env, pathname, request) => {
	const theSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const hashed = hash(sessionToken, theSalt).hash;

	const statement = 'DELETE FROM sessiontokens WHERE session_token_hash = ?';
	try {
		const query = env.blitz.prepare(statement).bind(hashed);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	const response = buildResponse('Logged out successfully.', 200, normalHeader);
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`);
	return {
		success: true,
		response: response
	}
}

/**
 * Deletes a session token from the database and from the client's cookies.
 * @param {string} tokenID The session token ID.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{success: boolean, response: Response}} Whether the deletion succeeded, with an appropriate Response object (with the session token removed if successful).
 */
const deleteSessionTokenFromTokenID = async (tokenID, env, pathname, request) => {
	const statement = 'DELETE FROM sessiontokens WHERE token_id = ?';
	try {
		const query = env.blitz.prepare(statement).bind(tokenID);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	return {
		success: true,
		response: buildResponse('Logged out successfully.', 200, normalHeader)
	}
}

/**
 * Deletes every session token from the database and from the client's cookies.
 * @param {string} userid The user ID of the user.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {string} sessionToken The session token as a string, taken from the cookie.
 * @returns {{success: boolean, response: Response}} Whether the deletion succeeded, with an appropriate Response object (with the session token removed if successful).
 */
const deleteAllSessionTokens = async (userid, env, pathname, request, sessionToken) => {
	const statement = 'DELETE FROM sessiontokens WHERE userid = ?';
	try {
		const query = env.blitz.prepare(statement).bind(userid);
		await query.run();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	const response = buildResponse('Logged out of all devices successfully.', 200, normalHeader);
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`);
	return {
		success: true,
		response: response
	}
}

/**
 * Checks whether a file has the correct magic bytes its expected extension.
 * @param {Blob} file The file blob to be checked.
 * @param {string} expectedExtension The expected file type for this file, as a file extension.
 * @returns {Promise<Boolean>} Whether the file is safe or not.
 */
const checkFileMagicBytes = async (file, expectedExtension) => {
	const bytes = file instanceof Uint8Array
		? file
		: new Uint8Array(await file.arrayBuffer());
	if (expectedExtension === 'f3d/f3z') {
		if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true;
		else return false;
	}
	else if (expectedExtension === 'glb') {
		if (bytes[0] === 0x67 && bytes[1] === 0x6C && bytes[2] === 0x54 && bytes[3] === 0x46) return true;
		else return false;
	}
	else if (expectedExtension === 'png') {
		if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) return true;
		else return false;
	}
	else if (expectedExtension === 'glb/png') {
		if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) return true;
		else if (bytes[0] === 0x67 && bytes[1] === 0x6C && bytes[2] === 0x54 && bytes[3] === 0x46) return true;
		else return false;
	}
	else return false;
}

/**
 * Fetches the metadata of all cars from a database.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{success: boolean, response: Response | Array<Object>}} Whether the fetch succeeded, with an appropriate Response object based on whether it did or not, or an array of Objects with each car as its own Object in the array.
 */
const fetchAllCars = async (env, pathname, request) => {
	let response;
	let success = true;
	const maxIteration = await identifyMaxIteration(request, pathname, env);
	if (!maxIteration.success) {
		response = maxIteration.response;
		success = false;
	}
	else {
		const cars = [];

		for (let i = 1; i <= maxIteration.response; i++) {
			const metadata = await pullCarMetaDataWithIterationNumber(i, env, pathname, request, false);
			if (!metadata.success) {
				response = metadata.response;
				success = false;
				break;
			}
			else {
				if (pathname === '/api/all-cars') cars.push(`${metadata.data['car_name']} by ${metadata.data.creatorName} (Iteration #${metadata.data.iteration})`);
				else cars.push(metadata.data);
			}
		}

		if (pathname === '/api/all-cars' && success) response = buildResponse('Fetched successfully.', 200, normalHeader, { cars: cars });
		else response = cars;
	}
	return {
		success: success,
		response: response
	}
}

/**
 * Fetches the metadata of all users.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @returns {{success: boolean, response: Response | Array<Object>}} Whether the fetch succeeded, with an appropriate Response object based on whether it did or not, or an array of Objects with each user as its own Object in the array.
 */
const fetchAllUsers = async (env, pathname, request) => {
	let response;
	let success = true;

	const users = [];

	for (let i of ['cheese', 'yashhasnolife67', 'ihatedeodorant67', 'unc', 'healthyballhair', 'mrtwose']) {
		const userFetch = await fetchUserDataFromUsername(request, pathname, env, i);
		if (!userFetch.success) {
			success = false;
			response = userFetch.response;
			break;
		}
		else users.push(userFetch.response);
	}

	if (success) response = users;

	return {
		success: success,
		response: response
	}
}

/**
 * Fetches all the current sessions by a specific user.
 * @param {Env} env
 * @param {string} pathname The API endpoint called by the client.
 * @param {Request} request The Request object associated with it.
 * @param {string} userid The user's user id.
 * @returns {{ success: Boolean, response: Response | Array<{ browser: String, ip: String, geolocation: String, last_accessed: ISODateString }> }} Whether the request succeeded or not, with an array of JavaScript Objects of the details of each session token if it did, or a sample error Response if not.
 */
const fetchCurrentSessions = async (env, pathname, request, userid) => {
	const statement = 'SELECT browser, ip, geolocation, last_accessed, token_id FROM sessiontokens WHERE userid = ?';
	let sessions;

	try {
		const selection = env.blitz.prepare(statement).bind(userid);
		sessions = await selection.all();
	}
	catch (error) {
		log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 500, normalHeader)
		}
	}

	if (sessions.results.length === 0) {
		log('warn', pathname, request, `D1 query returned no results when attempting to execute the statement: ${statement}`);
		return {
			success: false,
			response: buildResponse('There was an unexpected error.', 401, normalHeader)
		}
	}
	else {
		return {
			success: true,
			response: buildResponse('Fetched successfully.', 200, normalHeader, sessions.results)
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
    pullCarMetaDataWithIterationNumber,
    pullCarMetaDataWithCarID,
    uploadCarMetadata,
    identifyMaxIteration,
    pullCarFile,
    parseRequestBlob,
    uploadCarFile,
    deleteSessionTokenFromSessionToken,
	deleteSessionTokenFromTokenID,
    deleteAllSessionTokens,
	updatePassword,
	checkFileMagicBytes,
	fetchAllCars,
	fetchCurrentSessions,
	fetchAllUsers
};