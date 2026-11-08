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
                    results = await selection.all();
                }
                catch (error) {
                    await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${i.requirements.dbCheck.statement}`, error);
                    return {
                        success: false,
                        response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                    }
                }
                
                if (results.results.length === 0) {
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

const updateLastLogin = async (pathname, request, env, enteredUsername, sessionToken) => {
	const currentDate = (new Date()).toISOString();
	const statement = 'UPDATE users SET last_login = ? WHERE username = ?';

	try {
		const query = env.blitz.prepare(statement).bind(currentDate, enteredUsername);
		await query.run();
	}
	catch (error) {
		await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${statement}`, error);
        // delete session token
		return await buildResponse('There was an unexpected error.', 500, normalHeader);
	}

    const response = await buildResponse('Logging in...', 200, normalHeader);
    response.headers.append('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Max-Age=86400; Path=/; SameSite=None; Secure;`);

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

    if (result.length === 0) {
        await log('warn', pathname, request, `No results were found during password fetch when executing the statement: ${statement}`, error);
		return {
			allow: false,
			response: await buildResponse('There was an unexpected error.', 500, normalHeader)
		}
    }

    const expectedFields = ['password_hash', 'password_salt']

    for (let i of expectedFields) {
		if (!Object.hasOwn(result[0], i)) {
			await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch password data for user ${username}; statement: ${statement}`);
            return {
                allow: false,
                response: await buildResponse('There was an unexpected error.', 500, normalHeader)
            }
		}
	}
	
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

    if (result.results.length === 0) {
        await log('warn', pathname, request, `D1 query returned no data when attempting to fetch active data for user ${username}; statement: ${statement}`);
        return {
            allow: false,
            response: await buildResponse('There was an unexpected error.', 500, normalHeader)
        }
    }

	if (!Object.hasOwn(result.results[0], 'active')) {
		await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch active data for user ${username}; statement: ${statement}`);
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
	const userID = await fetchUserDataFromUsername(request, pathname, env, enteredUsername);
    if (!userID.success) {
        return {
            allow: false,
            response: userID.response
        }
    }

	const date = new Date();
	date.setDate(date.getDate() + 1);
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
        if (!Object.hasOwn(results.results[0], 'session_token_hash')) {
            await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch session token data for (hashed) token ${attemptedHash}; statement: ${statement}`);
            return {
                allow: false,
                response: await buildResponse('There was an unexpected error.', 500, normalHeader)
            }
        }
		if (compare(attemptedHash, results.results[0]['session_token_hash'])) {
            if (!Object.hasOwn(results.results[0], 'userid')) {
                await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch session token data for (hashed) token ${attemptedHash}; statement: ${statement}`);
                return {
                    allow: false,
                    response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                }
            }
            else {
                return {
                    allow: true,
                    userid: results.results[0].userid
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
            response: await buildResponse('User not found.', 404, normalHeader)
        }
	}
	else {
        const expectedFields = ['name', 'username', 'last_login', 'iterations'];
        for (let i of expectedFields) {
			if (!Object.hasOwn(results.results[0], i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch user data for user id ${userid}; statement: ${statement}`);
                return {
                    success: false,
                    response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                }
			}
		}

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
        const expectedFields = ['name', 'userid', 'last_login', 'iterations'];
        for (let i of expectedFields) {
			if (!Object.hasOwn(results.results[0], i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch user data for username ${username}; statement: ${statement}`);
                return {
                    success: false,
                    response: await buildResponse('There was an unexpected error.', 500, normalHeader)
                }
			}
		}

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
            response: await buildResponse('File successfully fetched', 200, contentHeader, 'BLOB', finalPayload)
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
			data = await query.all();
		}
		catch (error) {
			await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${carStatement}`, error);
			success = false;
			response = await buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		if (data.results.length === 0) {
			await log('warn', pathname, request, `D1 query returned no data when attempting to fetch metadata for iteration ${iterationNumber}; statement: ${carStatement}`);
			success = false;
			response = await buildResponse('There was an unexpected error.', 400, normalHeader);
			throw new Error();
		}

		for (let i of expectedCarFields) {
			if (!Object.hasOwn(data.results[0], i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch metadata for iteration ${iterationNumber}; statement: ${carStatement}`);
				response = await buildResponse('There was an unexpected error.', 500, normalHeader);
				success = false;
				throw new Error();
			}
		}

		data = data.results[0];

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
			data = await query.all();
		}
		catch (error) {
			await log('error', pathname, request, `D1 query failed when attempting to execute the statement: ${carStatement}`, error);
			success = false;
			response = await buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		if (data.results.length === 0) {
			await log('warn', pathname, request, `D1 query returned no data when attempting to fetch metadata for car id ${carid}; statement: ${carStatement}`);
			success = false;
			response = await buildResponse('There was an unexpected error.', 500, normalHeader);
			throw new Error();
		}

		for (let i of expectedCarFields) {
			if (!Object.hasOwn(data.results[0], i)) {
				await log('warn', pathname, request, `D1 query returned malformed data when attempting to fetch metadata for car id ${carid}; statement: ${carStatement}`);
				response = await buildResponse('There was an unexpected error.', 500, normalHeader);
				success = false;
				throw new Error();
			}
		}

		data = data.results[0];

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

    const fileType = potentialFiles.objects[0].key.split('.')[1];
    let header;
    switch (fileType) {
        case 'png':
            header = 'image/png';
            break;
        case 'glb':
            header = 'model/gltf-binary';
            break;
        default:
            header = 'application/octet-stream';
    }

	const fetch = await fetchFromR2(request, pathname, env, potentialFiles.objects[0].key, header);
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
    deleteAllSessionTokens
};