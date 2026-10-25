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

	const hashedToken = hasher.hash(sessionToken);
	const tokenHash = hashedToken.hash;
	const tokenSalt = hashedToken.salt;

	const query = env.blitz.prepare('INSERT INTO sessiontokens (session_token_hash, session_token_salt, userid, expiration_date) VALUES (? ? ?);').bind(tokenHash, tokenSalt, userID, expiry);
	await query.run();

	const check = env.blitz.prepare('SELECT session_token FROM sessiontokens WHERE expiration_date = ?').bind(expiry);
	const checkResult = await check.run();

	if (checkResult.results[0]['session_token'] === sessionToken) {
		return true;
	}
	else {
		return false;
	}
}

const checkSessionToken = async (sessionToken, env) => {
	const hasher = require('../hasher.js');
	const query = env.blitz.prepare('SELECT session_token_hash, session_token_salt, userid FROM sessiontokens WHERE session_token_hash').bind()
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
	})
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
			if (pathname === '/api/auth/') {
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
						const attempt = addNewSessionToken(sessionToken, env, enteredUsername);

						if (attempt) {
							return new Response(JSON.stringify({ message: 'Login successful' }), { 
								status: 200,
								headers: {
									'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
									'Content-Type': 'application/json; charset=UTF-8',
									'Cache-Control': 'no-store',
									'X-Content-Type-Options': 'nosniff',
									'Vary': 'Origin',
									'Access-Control-Allow-Credentials': 'true',
									'Set-Cookie': `session_token=${sessionToken}; HttpOnly; Max-Age=86400; Path=/; SameSite=None; Secure; `
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
			else if (pathname === '/api/cars/') {
				// this doesn't work yet, therefore return 404 by default in case someone stumbles on it or I accidentally use it. plz dont deduct my hours for this, the commented out code took like 10 minutes tops
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
				})

				// check if the user has the correct session token first
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
					})
				}
				
				if (request.method === 'GET') {

				}
				else if (request.method === 'POST') {

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
					})
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
