// add ratelimiting to all endpoints
// improve how errors are sent (make them more useful)
// clean up spaghetti code
// replace any .all() with .first()
// check that all properties exist after d1 query
// decrease number of helpers e.g. fetchuserdata can do everything

const normalHeader = 'application/json; charset=UTF-8';
const { convertBufferToString, hash, compare, addNewSessionToken, checkIfActive, authenticate, checkUsername, banIP, checkIPBanned, updateLastLogin, handleIPBan, validateInputs, parseRequestJSON, checkRequest, log, buildResponse, checkSessionToken, parseCookies, checkSession, fetchUserDataFromUserID, fetchUserDataFromUsername, fetchFromR2, pullCarMetaDataWithIterationNumber, pullCarMetaDataWithCarID } = require('../helpers.js');

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

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

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
			if (url.pathname === '/api/auth') {
				const requestCheck = await checkRequest(url.pathname, request, ['POST'], 'application/json')
				if (!requestCheck.success) return requestCheck.response;

				const parseRequest = await parseRequestJSON(url.pathname, request, ['username', 'password']);
				if (!parseRequest.success) return parseRequest.response;

				const enteredUsername = parseRequest.json.username;
				const enteredPassword = parseRequest.json.password;
				const inputs = [{
					name: 'username',
					input: enteredUsername,
					requirements: {
						dataType: 'string',
						minLength: 3,
						maxLength: 25
					}
				}, {
					name: 'password',
					input: enteredPassword,
					requirements: {
						dataType: 'string',
						minLength: 3,
						maxLength: 128
					}
				}];

				const inputCheck = await validateInputs(url.pathname, request, inputs, env, true);
				if (!inputCheck.success) return inputCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;
				
				const usernameExists = await checkUsername(enteredUsername, env, url.pathname, request);
				if (!usernameExists.allow) return usernameExists.response;

				const passwordCorrect = await authenticate(enteredUsername, enteredPassword, env, url.pathname, request);
				if (passwordCorrect.allow) {
					const active = await checkIfActive(enteredUsername, env, url.pathname, request);
					if (active.allow) {
						const sessionToken = crypto.randomUUID();

						const attempt = await addNewSessionToken(sessionToken, env, enteredUsername, url.pathname, request);
						if (attempt.success) return await updateLastLogin(url.pathname, request, env, enteredUsername, sessionToken);
						else return attempt.response;
					}
					else return active.response;
				}
				else return passwordCorrect.response;
			}

			else if (url.pathname === '/api/account') {
				const requestCheck = await checkRequest(url.pathname, request, ['GET']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;

				const userid = sessionCheck.userid;
				const dataFetch = await fetchUserDataFromUserID(request, url.pathname, env, userid);
				if (!dataFetch.success) return dataFetch.response;
				else return await buildResponse('Fetching user data..', 200, normalHeader, dataFetch.response);
			}

			else if (url.pathname === '/api/profile') {
				const requestCheck = await checkRequest(url.pathname, request, ['GET']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;

				const username = url.searchParams.get('username');
				const usernameInput = {
					name: 'username',
					input: username,
					requirements: {
						minLength: 3,
						maxLength: 25,
						dataType: 'string'
					}
				}
				const inputCheck = await validateInputs(url.pathname, request, [usernameInput], env);
				if (!inputCheck.success) return inputCheck.response;

				const userFetch = await fetchUserDataFromUsername(request, url.pathname, env, username);
				if (!userFetch.success) return userFetch.response;

				return await fetchFromR2(request, url.pathname, env, `assets/profiles/${userFetch.response.userid}.jpg`, 'image/jpeg').response;
			}
			else if (url.pathname === '/api/dashboard/text') {
				const requestCheck = await checkRequest(url.pathname, request, ['GET', 'POST']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;
				const userid = sessionCheck.userid;
				
				if (request.method === 'GET') {
					const dataFetch = await fetchUserDataFromUserID(request, url.pathname, env, userid);
					if (!dataFetch.success) return dataFetch.response;

					// breaking change: backend no longer sends username and name, use /api/account for that
					// breaking change: to call for latest iterations, send 0 in the iteration number parameter
					// breaking change: backend now just sends the car in json, there is no nested objects now

					const iterationNumber = Number(url.searchParams.get('iterationNumber'));
					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;
					const iterationInput = {
						name: 'iterationNumber',
						input: iterationNumber,
						requirements: {
							minValue: 0,
							maxValue: maxIteration.response,
							dataType: 'number'
						}
					}

					const inputCheck = await validateInputs(url.pathname, request, [iterationInput], env);
					if (!inputCheck.success) return inputCheck.response;

					if (iterationNumber === 0) {
						const carData = await pullCarMetaDataWithIterationNumber(maxIteration.response, env, url.pathname, request, true);

						if (!carData.success) return carData.response;
						else return await buildResponse('Fetched car data', 200, normalHeader, carData.data);
					}
					else {
						const carData = await pullCarMetaDataWithIterationNumber(iterationNumber, env, url.pathname, request, true);

						if (!carData.success) return carData.response;
						else return await buildResponse('Fetched car data', 200, normalHeader, carData.data);
					}
				}
				else if (request.method === 'POST') {
					const requestCheck = await checkRequest(url.pathname, request, ['POST'], 'application/json');
					if (!requestCheck.success) return requestCheck.response;

					const parseRequest = await parseRequestJSON(url.pathname, request, ['carName', 'dateCreated', 'frontalArea', 'dragCoefficient', 'scrutineerer', 'derivedCar', 'changelog', 'addDetails']);
					if (!parseRequest.success) return parseRequest.response;

					const requestObject = parseRequest.json;

					if (typeof reqJson.carName !== 'string') {
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

					reqJson.carName = reqJson.carName.trim();

					if (reqJson.carName.length > 50) {
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

					if (reqJson.carName.length < 3) {
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

					if (typeof reqJson.dateCreated !== 'string') {
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

					reqJson.dateCreated = reqJson.dateCreated.trim();

					const dateMade = new Date(reqJson.dateCreated);

					if (`${dateMade}` === 'Invalid Date') {
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

					const upperBound = new Date('2028-01-01');
					const lowerBound = new Date('2026-10-01');

					if (dateMade > upperBound) {
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

					if (dateMade < lowerBound) {
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

					if (typeof reqJson.frontalArea !== 'number') {
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

					if (reqJson.frontalArea > 5000) {
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

					if (reqJson.frontalArea < 1000) {
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

					if (typeof reqJson.dragCoefficient !== 'number') {
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

					if (reqJson.dragCoefficient > 2) {
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

					if (reqJson.dragCoefficient < 0) {
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

					if (typeof reqJson.scrutineerer !== 'string') {
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

					reqJson.scrutineerer = reqJson.scrutineerer.trim();

					if (!['chen', 'yash', 'pranit', 'josh'].includes(reqJson.scrutineerer)) {
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

					if (typeof reqJson.derivedCar !== 'number') {
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

					if (!Array.isArray(reqJson.changelog)) {
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

					if (reqJson.changelog.length > 167) {
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

					for (let i of reqJson.changelog) {
						if (i.trim().length > 1000) {
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
						if (i.trim() === '') {
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
					}

					if (typeof reqJson.addDetails !== 'string') {
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

					reqJson.addDetails = reqJson.addDetails.trim();

					if (reqJson.addDetails.length > 1000) {
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

					if (reqJson.addDetails === '' || reqJson.addDetails === 'null') {
						reqJson.addDetails = null;
					}

					let derivedCar;
					if (reqJson.derivedCar !== 0) {
						derivedCar = await pullCar(reqJson.derivedCar, env);
						if (!derivedCar) {
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
					}
					else {
						derivedCar = { carid: null }
					}

					const carid = crypto.randomUUID();

					try {
						const formattedScrutineerName = `${reqJson.scrutineerer[0].toUpperCase()}${reqJson.scrutineerer.slice(1).toLowerCase()}`;
						const scrutineeridQuery = env.blitz.prepare('SELECT userid FROM users WHERE name = ?').bind(formattedScrutineerName);
						const scrutineerIdQueried = await scrutineeridQuery.run();
						if (scrutineerIdQueried.results.length === 0) {
							throw new Error();
						}
						const scrutineerid = scrutineerIdQueried.results[0].userid;

						const dragForce = 0.5 * 1.196 * 225 * reqJson.dragCoefficient * reqJson.frontalArea / 1000000;
						const derivedCarID = derivedCar.carid;
						const changelog = reqJson.changelog.join('[BRK;]');

						const maxIterationQuery = env.blitz.prepare('SELECT MAX(iteration) as max_iteration FROM cars');
						const maxIterationProcess = await maxIterationQuery.run();
						// what if db empty?
						const maxIteration = maxIterationProcess.results[0]['max_iteration'];

						const query = env.blitz.prepare('INSERT INTO cars (creatorid, scrutineerid, carid, derived_carid, car_name, iteration, date_created, frontal_area, drag_coefficient, drag_force, changelog, additional_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(userid, scrutineerid, carid, derivedCarID, reqJson.carName, (maxIteration + 1), dateMade.toISOString(), reqJson.frontalArea, reqJson.dragCoefficient, dragForce, changelog, reqJson.addDetails);
						await query.run();

						const check = env.blitz.prepare('SELECT carid FROM cars WHERE iteration = ?').bind(maxIteration + 1);
						const checking = await check.run();

						if (checking.results[0].carid !== carid) {
							throw new Error();
						}
					}
					catch {
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
					
					return new Response(JSON.stringify({ 
						message: 'Metadata upload successful.',
						carid: carid
					}), {
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
			else if (url.pathname === '/api/dashboard/f3d') {
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

					if (contentType.split(';')[0].toLowerCase() !== 'application/octet-stream') {
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

					let blobbed;

					try {
						blobbed = await request.blob();
						if (!blobbed) throw new Error();
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

					if (blobbed.size > 100000000) {
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

					const url = new URL(request.url);
					const carid = url.searchParams.get('carid');
					const fileType = url.searchParams.get('fileType');

					if (!carid) {
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
					if (carid.length !== 36) {
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

					const checkExistenceQuery = env.blitz.prepare('SELECT date_created FROM cars WHERE carid = ?').bind(carid);
					const checkExistence = await checkExistenceQuery.run();

					if (checkExistence.results.length === 0) {
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

					if (!fileType) {
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
					if (fileType.length !== 3) {
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
					if (fileType.toLowerCase() !== 'f3d' && fileType.toLowerCase() !== 'f3z') {
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

					try {
						const object = await env.blitzr2.put(`assets/f3d/${carid}.${fileType.toLowerCase()}`, blobbed);
						if (object === null) throw new Error();
					}
					catch {
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

					return new Response(JSON.stringify({
						message: 'Car model upload successful.',
						carid: carid
					}), {
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
			else if (url.pathname === '/api/dashboard/preview') {
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
					let fileType;
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

					if (contentType.split(';')[0].toLowerCase() === 'image/png') fileType = 'png';
					else if (contentType.split(';')[0].toLowerCase() === 'model/gltf-binary') fileType = 'glb';
					else {
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

					let blobbed;

					try {
						blobbed = await request.blob();
						if (!blobbed) throw new Error();
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

					if (blobbed.size > 100000000) {
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

					const url = new URL(request.url);
					const carid = url.searchParams.get('carid');

					if (!carid) {
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
					if (carid.length !== 36) {
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

					const checkExistenceQuery = env.blitz.prepare('SELECT date_created FROM cars WHERE carid = ?').bind(carid);
					const checkExistence = await checkExistenceQuery.run();

					if (checkExistence.results.length === 0) {
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

					try {
						const object = await env.blitzr2.put(`assets/previews/${carid}.${fileType}`, blobbed);
						if (object === null) throw new Error();
					}
					catch {
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

					return new Response(JSON.stringify({ 
						message: 'Car preview upload successful.',
						carid: carid
					}), {
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
			else if (url.pathname === '/api/dashboard/iso') {
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

					if (contentType.split(';')[0].toLowerCase() !== 'image/png') {
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

					let blobbed;

					try {
						blobbed = await request.blob();
						if (!blobbed) throw new Error();
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

					if (blobbed.size > 5000000) {
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

					const url = new URL(request.url);
					const carid = url.searchParams.get('carid');

					if (!carid) {
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
					if (carid.length !== 36) {
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

					const checkExistenceQuery = env.blitz.prepare('SELECT date_created FROM cars WHERE carid = ?').bind(carid);
					const checkExistence = await checkExistenceQuery.run();

					if (checkExistence.results.length === 0) {
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

					try {
						const object = await env.blitzr2.put(`assets/iso/${carid}.png`, blobbed);
						if (object === null) throw new Error();
					}
					catch {
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

					return new Response(JSON.stringify({
						message: 'Iso surfaces upload successful.',
						carid: carid
					}), {
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
			else if (url.pathname === '/api/dashboard/planes') {
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

					if (contentType.split(';')[0].toLowerCase() !== 'image/png') {
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

					let blobbed;

					try {
						blobbed = await request.blob();
						if (!blobbed) throw new Error();
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

					if (blobbed.size > 5000000) {
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

					const url = new URL(request.url);
					const carid = url.searchParams.get('carid');

					if (!carid) {
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
					if (carid.length !== 36) {
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

					const checkExistenceQuery = env.blitz.prepare('SELECT date_created FROM cars WHERE carid = ?').bind(carid);
					const checkExistence = await checkExistenceQuery.run();

					if (checkExistence.results.length === 0) {
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

					try {
						const object = await env.blitzr2.put(`assets/planes/${carid}.png`, blobbed);
						if (object === null) throw new Error();
					}
					catch {
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

					return new Response(JSON.stringify({
						message: 'Planes upload successful.',
						carid: carid
					}), {
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
			else if (url.pathname === '/api/clear-all-sessions') {
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
			else if (url.pathname === '/api/logout') {
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
}
