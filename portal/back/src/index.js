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

const checkIPBanned = async (ip, env) => {
	const query = env.blitz.prepare('SELECT ip FROM ipbans');
	const queryResult = await query.run()
	const banList = queryResult.results;
	
	if (banList.length !== 0) {
		for (let i of banList) {
			if (i.ip === ip) {
				return true;
			}	
		}
		return false;
	}
}

const banIP = async (ip, env) => {
	const currentDate = (new Date()).toISOString();
	const insertion = env.blitz.prepare(`INSERT INTO ipbans (ip, date_banned) VALUES (?, ?);`).bind(ip, currentDate);
	await insertion.run();

	const check = env.blitz.prepare('SELECT ip from ipbans WHERE date_banned = ?;').bind(currentDate);
	let checkResults = await check.run()
	checkResults = checkResults.results[0];

	if (!checkResults) return false;

	if (checkResults.ip === ip) {
		console.log(`New IP banned: ${ip}`);
		return true;
	}
	else {
		console.log('IP couldn\'t be banned. Check database.');
		return false;
	}
}

const checkUsername = async (username, env) => {
	const hasher = require('../hasher.js')
	const query = env.blitz.prepare('SELECT username FROM users WHERE username = ?').bind(username);
	let result = await query.run();
	result = result.results;

	if (!result || result.length === 0) {
		// do some fake hashing to delay time
		const fakeHash = hasher.hash('676767676767').hash;
		compare(fakeHash, fakeHash);
		return false;
	}
	else {
		return true;
	}
}

const authenticate = async (username, enteredPassword, env) => {
	const hasher = require('../hasher.js');
	const query = env.blitz.prepare('SELECT password_hash, password_salt FROM users WHERE username = ?').bind(username);
	let result = await query.run()
	result = result.results;
	
	const trueHash = result[0]['password_hash'];
	const trueSalt = Buffer.from(result[0]['password_salt'], 'hex');

	const hashAttempt = hasher.hash(enteredPassword, trueSalt).hash;
	const hashesMatch = compare(trueHash, hashAttempt);

	if (hashesMatch) {
		return true;
	}
	else {
		return false;
	}
}

const checkIfActive = async (username, env) => {
	const query = env.blitz.prepare('SELECT active FROM users WHERE username = ?').bind(username);
	let result = await query.run()
	result = result.results[0].active;

	if (result === 1) {
		return true;
	}
	else {
		return false;
	}
}

const lockAccount = async (username, env) => {
	const query = env.blitz.prepare('UPDATE users SET active = 0 WHERE username = ?').bind(username);
	await query.run();

	const check = env.blitz.prepare('SELECT active FROM users WHERE username = ?').bind(username)
	let result = await check.run()
	result = result.results[0].active;

	if (result === 0) {
		console.log(`Account ${username} has been disabled`);
		return true;
	}
	else {
		console.log(`Account ${username} couldn't be disabled. Check logs.`);
		return false;
	}
}

const addNewSessionToken = async (sessionToken, env, enteredUsername) => {
	const hasher = require('../hasher.js');

	const idQuery = env.blitz.prepare('SELECT userid FROM users WHERE username = ?').bind(enteredUsername);
	const idResult = await idQuery.run();
	const userID = idResult.results[0].userid;

	const date = new Date();
	date.setDate(date.getDate() + 1);
	const expiry = date.toISOString();

	const tokenSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const hashedToken = hasher.hash(sessionToken, tokenSalt);
	const tokenHash = hashedToken.hash;

	const query = env.blitz.prepare('INSERT INTO sessiontokens (session_token_hash, userid, expiration_date) VALUES (?, ?, ?);').bind(tokenHash, userID, expiry);
	await query.run();

	const check = env.blitz.prepare('SELECT session_token_hash FROM sessiontokens WHERE expiration_date = ?').bind(expiry);
	const checkResult = await check.run();

	const comparison = compare(checkResult.results[0]['session_token_hash'], tokenHash);

	if (comparison) {
		return true;
	}
	else {
		return false;
	}
}

const checkSessionToken = async (sessionToken, env) => {
	const hasher = require('../hasher.js');
	const theSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const attemptedHash = hasher.hash(sessionToken, theSalt).hash;
	const currentDate = (new Date()).toISOString();

	const query = env.blitz.prepare('SELECT session_token_hash, userid FROM sessiontokens WHERE session_token_hash = ? AND expiration_date > ?').bind(attemptedHash, currentDate);
	const results = await query.run();

	if (results.results.length === 0) {
		return false;
	}
	else {
		if (compare(attemptedHash, results.results[0]['session_token_hash'])) {
			return results.results[0].userid;
		}
		else {
			return false;
		}
	}
}

const deleteSessionToken = async (sessionToken, env) => {
	const hasher = require('../hasher.js');
	const theSalt = Buffer.from(env.sessionTokenSalt, 'hex');
	const attemptedHash = hasher.hash(sessionToken, theSalt).hash;

	const query = env.blitz.prepare('DELETE FROM sessiontokens WHERE session_token_hash = ?').bind(attemptedHash);
	await query.run();

	const check = env.blitz.prepare('SELECT session_token_hash FROM sessiontokens WHERE session_token_hash = ?').bind(attemptedHash);
	const result = await check.run();
	
	if (result.results.length !== 0) {
		return false;
	}
	else {
		return true;
	}
}

const deleteAllSessionTokens = async (userid, env) => {
	const query = env.blitz.prepare('DELETE FROM sessiontokens WHERE userid = ?').bind(userid);
	await query.run();

	const check = env.blitz.prepare('SELECT session_token_hash FROM sessiontokens WHERE userid = ?').bind(userid);
	const result = await check.run();

	if (result.results.length !== 0) {
		return false;
	}
	else {
		return true;
	}
}

const updatePassword = async (userid, env, newPassword) => {
	const hasher = require('../hasher.js');
	const hashAndSalt = hasher.hash(newPassword);
	const query = env.blitz.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE userid = ?').bind(hashAndSalt.hash, hashAndSalt.salt, userid);
	await query.run();

	const check = env.blitz.prepare('SELECT password_hash, password_salt FROM users WHERE userid = ?').bind(userid);
	const result = await check.run();

	if ((result.results[0]['password_hash'] !== hashAndSalt.hash) || (result.results[0]['password_salt'] !== hashAndSalt.salt)) {
		return false;
	}
	else {
		return true;
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

const pullCar = async (iterationNumber, env) => {
	let finalObject;
	try {
		const query = env.blitz.prepare('SELECT creatorid, scrutineerid, carid, derived_carid, car_name, iteration, date_created, frontal_area, drag_coefficient, drag_force, changelog, additional_notes FROM cars WHERE iteration = ?').bind(iterationNumber);
		const queryDone = await query.run();
		if (queryDone.results.length === 0) {
			throw new Error(`Iteration number ${iterationNumber} is missing from db!!`);
		}
		if (!queryDone.results[0].creatorid) {
			throw new Error(`Iteration number ${iterationNumber} is missing a creator id`);
		}

		finalObject = queryDone.results[0];

		const userQuery = env.blitz.prepare('SELECT username, name FROM users WHERE userid = ?').bind(queryDone.results[0].creatorid);
		const userDone = await userQuery.run();
		if (userDone.results.length === 0) {
			throw new Error(`Creator id for iteration number ${iterationNumber} does not map to an actual user.`);
		}

		if (!queryDone.results[0].scrutineerid) {
			throw new Error(`Iteration number ${iterationNumber} is missing a creator id`);
		}

		const scrutineerQuery = env.blitz.prepare('SELECT name FROM users WHERE userid = ?').bind(queryDone.results[0].scrutineerid);
		const scrutineerDone = await scrutineerQuery.run();
		if (scrutineerDone.results.length === 0) {
			throw new Error(`Scrutineer id for iteration number ${iterationNumber} does not map to an actual user.`);
		}

		if (queryDone.results[0]['derived_carid'] !== null) {
			const derivedQuery = env.blitz.prepare('SELECT iteration, car_name FROM cars WHERE carid = ?').bind(queryDone.results[0]['derived_carid']);
			const derivedDone = await derivedQuery.run();
			if (derivedDone.results.length === 0) {
				throw new Error(`Derived car id for iteraiton number ${iterationNumber} does not map to an actual car.`);
			}
			finalObject.derivedCarName = derivedDone.results[0]['car_name'];
			finalObject.derivedCarIteration = derivedDone.results[0].iteration;
		}

		finalObject.creatorName = userDone.results[0].name;
		finalObject.creatorUsername = userDone.results[0].username;
		finalObject.scrutineerName = scrutineerDone.results[0].name;

		if (!queryDone.results[0].changelog) throw new Error(`Iteration number ${iterationNumber} is missing a changelog`);
		finalObject.changelog = queryDone.results[0].changelog.split('[BRK;]');
	}
	catch (error) {
		console.error(error)
		return false;
	}
	return finalObject;
}

const pullCarModel = async (iterationNumber, env) => {
	try {
		const query = env.blitz.prepare('SELECT carid FROM cars WHERE iteration = ?').bind(iterationNumber);
		const queryDone = await query.run();
		if (queryDone.results.length === 0) {
			throw new Error(`Iteration number ${iterationNumber} is missing from db!!`);
		}

		const carModelList = await env.blitzr2.list({ prefix: `assets/f3d/${queryDone.results[0].carid}` });
		if (carModelList.objects.length === 0) {
			throw new Error(`Car model is not present in R2 for iteration number ${iterationNumber}`);
		}

		const carModel = await env.blitzr2.get(carModelList.objects[0].key);
			
		return await carModel.blob();
	}
	catch (error) {
		console.error(error)
		return false;
	}
}

const pullCarPreview = async (iterationNumber, env) => {
	try {
		const query = env.blitz.prepare('SELECT carid FROM cars WHERE iteration = ?').bind(iterationNumber);
		const queryDone = await query.run();
		if (queryDone.results.length === 0) {
			throw new Error(`Iteration number ${iterationNumber} is missing from db!!`);
		}

		const carPreviewList = await env.blitzr2.list({ prefix: `assets/previews/${queryDone.results[0].carid}` });
		if (carPreviewList.objects.length === 0) {
			throw new Error(`Car preview is not present in R2 for iteration number ${iterationNumber}`);
		}

		const carPreview = await env.blitzr2.get(carPreviewList.objects[0].key);

		if (carPreviewList.objects[0].key.split('.')[1] === 'png') {
			return {
				file: await carPreview.blob(),
				type: 'img'
			}
		}
		else if (carPreviewList.objects[0].key.split('.')[1] === 'step') {
			return {
				file: await carPreview.blob(),
				type: 'step'
			}
		}
		else if (carPreviewList.objects[0].key.split('.')[1] === 'glb') {
			return {
				file: await carPreview.blob(),
				type: 'glb'
			}
		}
		else {
			return false;
		}
	}
	catch (error) {
		console.error(error);
		return false;
	}
}

const pullCarIsoSurfaces = async (iterationNumber, env) => {
	try {
		const query = env.blitz.prepare('SELECT carid FROM cars WHERE iteration = ?').bind(iterationNumber);
		const queryDone = await query.run();
		if (queryDone.results.length === 0) {
			throw new Error(`Iteration number ${iterationNumber} is missing from db!!`);
		}

		const isoList = await env.blitzr2.list({ prefix: `assets/iso/${queryDone.results[0].carid}` });
		if (isoList.objects.length === 0) {
			throw new Error(`Iso surfaces is not present in R2 for iteration number ${iterationNumber}`);
		}

		const iso = await env.blitzr2.get(isoList.objects[0].key);
			
		return await iso.blob();
	}
	catch (error) {
		console.error(error)
		return false;
	}
}

const pullCarPlanes = async (iterationNumber, env) => {
	try {
		const query = env.blitz.prepare('SELECT carid FROM cars WHERE iteration = ?').bind(iterationNumber);
		const queryDone = await query.run();
		if (queryDone.results.length === 0) {
			throw new Error(`Iteration number ${iterationNumber} is missing from db!!`);
		}

		const carModelList = await env.blitzr2.list({ prefix: `assets/planes/${queryDone.results[0].carid}` });
		if (carModelList.objects.length === 0) {
			throw new Error(`Planes is not present in R2 for iteration number ${iterationNumber}`);
		}

		const carModel = await env.blitzr2.get(carModelList.objects[0].key);
			
		return await carModel.blob();
	}
	catch (error) {
		console.error(error)
		return false;
	}
}

export default {
	async fetch(request, env, ctx) {
		const { pathname } = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, { 
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Max-Age': 600,
					'Vary': 'Origin'
				}
			});
		}

		try {
			if (pathname === '/api/auth') {
				if (request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'POST, OPTIONS'
						}
					});
				}

				const contentType = request.headers.get('Content-Type');
				if (!contentType || typeof contentType !== 'string') {
					return new Response(JSON.stringify({ message: 'Unsupported Media Type.' }), { 
						status: 415,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				if (contentType.split(';')[0].toLowerCase() !== 'application/json') {
					return new Response(JSON.stringify({ message: 'Unsupported Media Type.' }), { 
						status: 415,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				let reqJson;

				try {
					reqJson = await request.json();
					if (!reqJson) {
						throw new Error();
					}
					if (typeof reqJson !== 'object'){
						throw new Error();
					}
					if (Array.isArray(reqJson)){
						throw new Error();
					}
					if (!Object.hasOwn(reqJson, 'username') || !Object.hasOwn(reqJson, 'password')) {
						throw new Error();
					}
				}
				catch {
					return new Response(JSON.stringify({ message: 'Bad request.' }), { 
						status: 400,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const enteredUsername = reqJson.username;
				const enteredPassword = reqJson.password;

				if (typeof enteredUsername !== 'string' || typeof enteredPassword !== 'string') {
					await checkUsername("67", env);
					return new Response(JSON.stringify({ message: 'Invalid username or password.' }), { 
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				if (!enteredUsername || !enteredPassword) {
					await checkUsername("67", env);
					return new Response(JSON.stringify({ message: 'Invalid username or password.' }), { 
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				if (enteredUsername.length === 0 || enteredUsername.length > 25) {
					await checkUsername("67", env);
					return new Response(JSON.stringify({ message: 'Invalid username or password.' }), { 
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				if (enteredPassword.length === 0 || enteredPassword.length > 128) {
					await checkUsername("67", env);
					return new Response(JSON.stringify({ message: 'Invalid username or password.' }), { 
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const ip = request.headers.get('cf-connecting-ip');
				if (!ip) {
					return new Response(JSON.stringify({ message: '500 Internal Server Error: Please contact the administrator.' }), { 
						status: 500,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const ipBanned = await checkIPBanned(ip, env)

				if (ipBanned) {
					return new Response(JSON.stringify({ message: 'You have been blocked from making further attempts. Please contact the administrator.' }), { 
						status: 429,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const { success } = await env.ratelimiter.limit({ key: ip });

				if (!success) {
					const attempt = await banIP(ip, env);
					const lockAttempt = await lockAccount(reqJson.username, env);

					if (attempt && lockAttempt) {
						return new Response(JSON.stringify({ message: 'You have been blocked from making further attempts. Please contact the administrator.' }), { 
							status: 429,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}
					else {
						return new Response(JSON.stringify({ message: '500 Internal Server Error: Please contact the administrator.' }), { 
							status: 500,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}
				}
				
				const usernameExists = await checkUsername(enteredUsername, env);

				if (!usernameExists) {
					return new Response(JSON.stringify({ message: 'Invalid username or password.' }), { 
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const passwordCorrect = await authenticate(enteredUsername, enteredPassword, env);

				if (passwordCorrect) {
					const active = await checkIfActive(enteredUsername, env);
					if (active) {
						const sessionToken = crypto.randomUUID();
						const attempt = await addNewSessionToken(sessionToken, env, enteredUsername);

						if (attempt) {
							const currentDate = (new Date()).toISOString();
							const query = env.blitz.prepare('UPDATE users SET last_login = ? WHERE username = ?').bind(currentDate, enteredUsername);
							await query.run();

							return new Response(JSON.stringify({ message: 'Login successful' }), { 
								status: 200,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true',
									'Set-Cookie': `session_token=${sessionToken}; HttpOnly; Max-Age=86400; Path=/; SameSite=None; Secure;`
								}
							});
						}
						else {
							console.log('Was unable to register a new session token; please check database!');
							return new Response(JSON.stringify({ message: '500 Internal Server Error: Please contact the administrator.' }), { 
								status: 500,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
					}
					else {
						return new Response(JSON.stringify({ message: 'Your account has been disabled. Please contact the administrator.' }), {
							status: 403,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true',
							}
						});
					}
				}
				else {
					return new Response(JSON.stringify({ message: 'Invalid username or password.' }), { 
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/account') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				if (request.method === 'GET') {
					const nameQuery = env.blitz.prepare('SELECT name, username, last_login FROM users WHERE userid = ?').bind(userid);
					const findName = await nameQuery.run();
					const results = findName.results[0]
					let responseObject = {
						name: results.name,
						username: results.username,
						lastLogin: results['last_login'],
						message: 'Account fetched successfully.'
					};

					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'K bro' }), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/profile') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				if (request.method === 'GET') {
					const nameQuery = env.blitz.prepare('SELECT name, username, last_login FROM users WHERE userid = ?').bind(userid);
					const findName = await nameQuery.run();
					const results = findName.results[0]
					let responseObject = {
						name: results.name,
						username: results.username,
						lastLogin: results['last_login'],
						message: 'Account fetched successfully.'
					};

					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'K bro' }), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/dashboard/text') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				
				if (request.method === 'GET') {
					const nameQuery = env.blitz.prepare('SELECT name, username FROM users WHERE userid = ?').bind(userid);
					const findName = await nameQuery.run();
					const name = findName.results[0].name;
					const username = findName.results[0].username;
					let responseObject = {
						name: name,
						username: username,
						message: 'Cars fetched successfully.'
					};

					const url = new URL(request.url);
					const iterationNumber = url.searchParams.get('iterationNumber');

					if (!iterationNumber) {
						return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
						});
					}

					const maxIterationQuery = await env.blitz.prepare('SELECT max(iteration) as max_iteration FROM cars').run();
					const maxIteration = maxIterationQuery.results[0]['max_iteration'];

					if ((!maxIteration) || (maxIteration === null)) {
						return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
							status: 502,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					if (iterationNumber === 'latest') {
						const carData = await pullCar(maxIteration, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						else {
							responseObject.car = carData;
						}
					}
					else {
						if (iterationNumber.trim() === '') {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if (!/^(0|[1-9]\d*)$/.test(iterationNumber)) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if ((!Number.isSafeInteger(Number(iterationNumber))) || (Number(iterationNumber) > maxIteration)){
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if (Number(iterationNumber) === 0) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}

						const carData = await pullCar(iterationNumber, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
						});
						}
						else {
							responseObject.car = carData;
						}
					}

					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else if (request.method === 'POST') {
					let responseObject = {};
					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), {
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/dashboard/f3d') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				
				if (request.method === 'GET') {
					let response;
					const url = new URL(request.url);
					const iterationNumber = url.searchParams.get('iterationNumber');

					if (!iterationNumber) {
						return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
							status: 400,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					const maxIterationQuery = await env.blitz.prepare('SELECT max(iteration) as max_iteration FROM cars').run();
					const maxIteration = maxIterationQuery.results[0]['max_iteration'];

					if ((!maxIteration) || (maxIteration === null)) {
						return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
							status: 502,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					if (iterationNumber === 'latest') {
						const carData = await pullCarModel(maxIteration, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						else {
							response = carData;
						}
					}
					else {
						if (iterationNumber.trim() === '') {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
							}
						if (!/^(0|[1-9]\d*)$/.test(iterationNumber)) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if ((!Number.isSafeInteger(Number(iterationNumber))) || (Number(iterationNumber) > maxIteration)){
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if (Number(iterationNumber) === 0) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}

						const carData = await pullCarModel(iterationNumber, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
						});
						}
						else {
							response = carData;
						}
					}

					return new Response(response, {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/octet-stream',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else if (request.method === 'POST') {
					let responseObject = {};
					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), {
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/dashboard/preview') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				
				if (request.method === 'GET') {
					let response;
					const url = new URL(request.url);
					const iterationNumber = url.searchParams.get('iterationNumber');

					if (!iterationNumber) {
						return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
							status: 400,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					const maxIterationQuery = await env.blitz.prepare('SELECT max(iteration) as max_iteration FROM cars').run();
					const maxIteration = maxIterationQuery.results[0]['max_iteration'];

					if ((!maxIteration) || (maxIteration === null)) {
						return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
							status: 502,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					if (iterationNumber === 'latest') {
						const carData = await pullCarPreview(maxIteration, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						else {
							response = carData;
						}
					}
					else {
						if (iterationNumber.trim() === '') {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
							}
						if (!/^(0|[1-9]\d*)$/.test(iterationNumber)) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if ((!Number.isSafeInteger(Number(iterationNumber))) || (Number(iterationNumber) > maxIteration)){
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if (Number(iterationNumber) === 0) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}

						const carData = await pullCarPreview(iterationNumber, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
							status: 502,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
						}
						else {
							response = carData;
						}
					}

					let contentHeader;
					if (response.type === 'img') {
						contentHeader = 'image/png';
					}
					else if (response.type === 'glb') {
						contentHeader = 'model/gltf-binary';
					}
					else if (response.type === 'step') {
						contentHeader = 'application/step';
						console.log('We dont support step files yet. The request will be rejected.');
						return new Response(JSON.stringify({ message: 'Design preview is of unsupported media type' }), {
							status: 500,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}
					return new Response(response.file, {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': contentHeader,
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else if (request.method === 'POST') {
					let responseObject = {};
					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), {
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/dashboard/iso') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				
				if (request.method === 'GET') {
					let response;
					const url = new URL(request.url);
					const iterationNumber = url.searchParams.get('iterationNumber');

					if (!iterationNumber) {
						return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
							status: 400,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					const maxIterationQuery = await env.blitz.prepare('SELECT max(iteration) as max_iteration FROM cars').run();
					const maxIteration = maxIterationQuery.results[0]['max_iteration'];

					if ((!maxIteration) || (maxIteration === null)) {
						return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
							status: 502,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					if (iterationNumber === 'latest') {
						const carData = await pullCarIsoSurfaces(maxIteration, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
									status: 502,
									headers: {
										'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
										'Content-Type': 'application/json; charset=UTF-8',
										'Cache-Control': 'no-store',
										'X-Content-Type-Options': 'nosniff',
										'Vary': 'Origin',
										'Access-Control-Allow-Credentials': 'true'
									}
							});
						}
						else {
							response = carData;
						}
					}
					else {
						if (iterationNumber.trim() === '') {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
									status: 400,
									headers: {
										'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
										'Content-Type': 'application/json; charset=UTF-8',
										'Cache-Control': 'no-store',
										'X-Content-Type-Options': 'nosniff',
										'Vary': 'Origin',
										'Access-Control-Allow-Credentials': 'true'
									}
							});
							}
						if (!/^(0|[1-9]\d*)$/.test(iterationNumber)) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
									status: 400,
									headers: {
										'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
										'Content-Type': 'application/json; charset=UTF-8',
										'Cache-Control': 'no-store',
										'X-Content-Type-Options': 'nosniff',
										'Vary': 'Origin',
										'Access-Control-Allow-Credentials': 'true'
									}
							});
						}
						if ((!Number.isSafeInteger(Number(iterationNumber))) || (Number(iterationNumber) > maxIteration)){
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
									status: 400,
									headers: {
										'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
										'Content-Type': 'application/json; charset=UTF-8',
										'Cache-Control': 'no-store',
										'X-Content-Type-Options': 'nosniff',
										'Vary': 'Origin',
										'Access-Control-Allow-Credentials': 'true'
									}
							});
						}
						if (Number(iterationNumber) === 0) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
									status: 400,
									headers: {
										'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
										'Content-Type': 'application/json; charset=UTF-8',
										'Cache-Control': 'no-store',
										'X-Content-Type-Options': 'nosniff',
										'Vary': 'Origin',
										'Access-Control-Allow-Credentials': 'true'
									}
							});
						}

						const carData = await pullCarIsoSurfaces(iterationNumber, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						else {
							response = carData;
						}
					}

					return new Response(response, {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'image/png',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else if (request.method === 'POST') {
					let responseObject = {};
					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), {
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/dashboard/planes') {
				if (request.method !== 'GET' && request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'GET, POST, OPTIONS'
						}
					});
				}
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				
				if (request.method === 'GET') {
					let response;
					const url = new URL(request.url);
					const iterationNumber = url.searchParams.get('iterationNumber');

					if (!iterationNumber) {
						return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
							status: 400,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					const maxIterationQuery = await env.blitz.prepare('SELECT max(iteration) as max_iteration FROM cars').run();
					const maxIteration = maxIterationQuery.results[0]['max_iteration'];

					if ((!maxIteration) || (maxIteration === null)) {
						return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
							status: 502,
							headers: {
								'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
								'Content-Type': 'application/json; charset=UTF-8',
								'Cache-Control': 'no-store',
								'X-Content-Type-Options': 'nosniff',
								'Vary': 'Origin',
								'Access-Control-Allow-Credentials': 'true'
							}
						});
					}

					if (iterationNumber === 'latest') {
						const carData = await pullCarPlanes(maxIteration, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						else {
							response = carData;
						}
					}
					else {
						if (iterationNumber.trim() === '') {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
							}
						if (!/^(0|[1-9]\d*)$/.test(iterationNumber)) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if ((!Number.isSafeInteger(Number(iterationNumber))) || (Number(iterationNumber) > maxIteration)){
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}
						if (Number(iterationNumber) === 0) {
							return new Response(JSON.stringify({ message: 'Error 400: Bad request. Please contact the administrator.' }), { 
								status: 400,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
							});
						}

						const carData = await pullCarPlanes(iterationNumber, env);

						if (!carData) {
							return new Response(JSON.stringify({ message: 'There was an error fetching car data. Please contact the administrator.' }), {
								status: 502,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true'
								}
						});
						}
						else {
							response = carData;
						}
					}

					return new Response(response, {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'image/png',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else if (request.method === 'POST') {
					let responseObject = {};
					return new Response(JSON.stringify(responseObject), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), {
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/clear-all-sessions') {
				if (request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'POST, OPTIONS'
						}
					});
				}

				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const userid = await checkSessionToken(sessionToken, env);

				if (!userid) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const deletion = await deleteAllSessionTokens(userid, env);

				if (deletion) {
					return new Response(JSON.stringify({ message: 'Logged out of all devices successfully.' }), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Set-Cookie': `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: '500 Internal Server Error: Please contact the administrator.' }), { 
						status: 500,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else if (pathname === '/api/logout') {
				if (request.method !== 'POST') {
					return new Response(JSON.stringify({ message: 'Incorrect method.' }), { 
						status: 405,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Allow': 'POST, OPTIONS'
						}
					});
				}

				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies = parseCookies(cookieHeader);
				const sessionToken = cookies['session_token'];

				if (!sessionToken) {
					return new Response(JSON.stringify({ message: 'Unauthorised' }), {
						status: 401,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}

				const deletion = await deleteSessionToken(sessionToken, env);

				if (deletion) {
					return new Response(JSON.stringify({ message: 'Logout successful' }), {
						status: 200,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true',
							'Set-Cookie': `session_token=${sessionToken}; HttpOnly; Max-Age=0; Path=/; SameSite=None; Secure;`
						}
					});
				}
				else {
					return new Response(JSON.stringify({ message: '500 Internal Server Error: Please contact the administrator.' }), { 
						status: 500,
						headers: {
							'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
							'Content-Type': 'application/json; charset=UTF-8',
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
							'Vary': 'Origin',
							'Access-Control-Allow-Credentials': 'true'
						}
					});
				}
			}
			else {
				return new Response(JSON.stringify({ message: 'Not Found' }), {
					status: 404,
					headers: {
						'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
						'Content-Type': 'application/json; charset=UTF-8',
						'Cache-Control': 'no-store',
						'X-Content-Type-Options': 'nosniff',
						'Vary': 'Origin',
						'Access-Control-Allow-Credentials': 'true'
					}
				});
			}
		}
		catch (e) {
			console.error(e);
			return new Response(JSON.stringify({ message: '500 Internal Server Error: Please contact the administrator.' }), { 
				status: 500,
				headers: {
					'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
					'Content-Type': 'application/json; charset=UTF-8',
					'Cache-Control': 'no-store',
					'X-Content-Type-Options': 'nosniff',
					'Vary': 'Origin',
					'Access-Control-Allow-Credentials': 'true'
				}
			});
		}
	},

	async scheduled(event, env, ctx) {
		const now = (new Date()).toISOString();

		const query = env.blitz.prepare('DELETE FROM sessiontokens WHERE expiration_date < ?').bind(now);
		await query.run();

		console.log('Performed automatic session token cleanup.');
	}
};
