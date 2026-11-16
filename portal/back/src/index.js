// breaking change: backend no longer sends username and name, use /api/account for that
// breaking change: backend now just sends the car in json, there is no nested objects now

const normalHeader = 'application/json; charset=UTF-8';
const { convertBufferToString, hash, compare, addNewSessionToken, checkIfActive, authenticate, checkUsername, banIP, checkIPBanned, updateLastLogin, handleIPBan, validateInputs, parseRequestJSON, checkRequest, log, buildResponse, checkSessionToken, parseCookies, checkSession, fetchUserDataFromUserID, fetchUserDataFromUsername, fetchFromR2, pullCarMetaDataWithIterationNumber, pullCarMetaDataWithCarID, identifyMaxIteration, uploadCarMetadata, pullCarFile, parseRequestBlob, uploadCarFile, deleteSessionToken, deleteAllSessionTokens, updatePassword, checkFileMagicBytes } = require('../helpers.js');

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
				const requestCheck = await checkRequest(url.pathname, request, ['POST'], ['application/json'])
				if (!requestCheck.success) return requestCheck.response;

				const parseRequest = await parseRequestJSON(url.pathname, request, ['username', 'password']);
				if (!parseRequest.success) return parseRequest.response;

				const enteredUsername = parseRequest.json.username;
				const enteredPassword = parseRequest.json.password;
				const rememberMe = parseRequest.json.rememberMe;
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
				}, {
					name: 'rememberMe',
					input: rememberMe,
					requirements: {
						dataType: 'boolean'
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

						const attempt = await addNewSessionToken(sessionToken, env, enteredUsername, url.pathname, request, rememberMe);
						if (attempt.success) return await updateLastLogin(url.pathname, request, env, enteredUsername, sessionToken, rememberMe);
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

				console.log(dataFetch.response);

				if (dataFetch.response['force_password_change'] === 1) return buildResponse('Your password has expired. Please change your password.', 403, normalHeader);
				else return buildResponse('Fetching user data..', 200, normalHeader, dataFetch.response);
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

				const finalFetch = await fetchFromR2(request, url.pathname, env, `assets/profiles/${userFetch.response.userid}.jpg`, 'image/jpeg');
				return finalFetch.response;
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
					const iterationNumberString = url.searchParams.get('iterationNumber');
					if (iterationNumberString === null) return buildResponse('There was an unexpected error.', 400, normalHeader);
					const iterationNumber = Number(iterationNumberString);
					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;
					const iterationInput = {
						name: 'iterationNumber',
						input: iterationNumber,
						requirements: {
							minValue: 0,
							maxValue: maxIteration.response,
							dataType: 'number',
							integer: true,
						}
					}

					const inputCheck = await validateInputs(url.pathname, request, [iterationInput], env);
					if (!inputCheck.success) return inputCheck.response;

					if (iterationNumber === 0) {
						const carData = await pullCarMetaDataWithIterationNumber(maxIteration.response, env, url.pathname, request, true);

						if (!carData.success) return carData.response;
						else return buildResponse('Fetched car data', 200, normalHeader, carData.data);
					}
					else {
						const carData = await pullCarMetaDataWithIterationNumber(iterationNumber, env, url.pathname, request, true);

						if (!carData.success) return carData.response;
						else return buildResponse('Fetched car data', 200, normalHeader, carData.data);
					}
				}
				else if (request.method === 'POST') {
					const requestCheck = await checkRequest(url.pathname, request, ['POST'], ['application/json']);
					if (!requestCheck.success) return requestCheck.response;

					const parseRequest = await parseRequestJSON(url.pathname, request, ['carName', 'dateCreated', 'frontalArea', 'dragCoefficient', 'scrutineerer', 'derivedCar', 'changelog', 'addDetails']);
					if (!parseRequest.success) return parseRequest.response;

					let data = parseRequest.json;
					data.dateCreated = new Date(data.dateCreated);
					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;

					const inputs = [{
						name: 'carName',
						input: data.carName,
						requirements: {
							dataType: 'string',
							minLength: 3,
							maxLength: 50,
						}
					}, {
						name: 'dateCreated',
						input: data.dateCreated,
						requirements: {
							dataType: 'date',
							minValue: new Date('2026-10-01'),
							maxValue: new Date('2028-01-01')
						}
					}, {
						name: 'frontalArea',
						input: data.frontalArea,
						requirements: {
							dataType: 'number',
							minValue: 1000,
							maxValue: 5000,
							integer: false
						}
					}, {
						name: 'dragCoefficient',
						input: data.dragCoefficient,
						requirements: {
							dataType: 'number',
							minValue: 0,
							maxValue: 2,
							integer: false
						}
					}, {
						name: 'scrutineerer',
						input: data.scrutineerer,
						requirements: {
							dataType: 'string',
							minLength: 4,
							maxLength: 6,
							specificValues: ['chen', 'yash', 'pranit', 'josh']
						}
					}, {
						name: 'changelog',
						input: data.changelog,
						requirements: {
							dataType: 'string',
							minLength: 10,
							maxLength: 1000
						}
					}, {
						name: 'addDetails',
						input: data.addDetails,
						requirements: {
							dataType: 'string',
							minLength: 0,
							maxLength: 1000,
						}
					}, {
						name: 'derivedCar',
						input: data.derivedCar,
						requirements: {
							dataType: 'number',
							integer: true,
							minValue: 0,
							maxValue: maxIteration.response,
							dbCheck: {
								statement: 'SELECT * FROM cars WHERE iteration = ?',
								vars: [data.derivedCar],
								exclusion: 0
							}
						}
					}];

					const inputCheck = await validateInputs(url.pathname, request, inputs, env);
					if (!inputCheck.success) return inputCheck.response;

					if (data.addDetails === '') data.addDetails = null;

					let derivedCarID = null;
					if (data.derivedCar !== 0) {
						const derivedCar = await pullCarMetaDataWithIterationNumber(data.derivedCar, env, url.pathname, request, false);
						if (!derivedCar.success) return derivedCar.response;
						else derivedCarID = derivedCar.data.carid;
					}

					const mapScrutineer = {
						chen: 'cheese',
						yash: 'yashhasnolife',
						josh: 'healthyballhair123',
						pranit: 'deodoranthater67'
					}
					const scrutineer = await fetchUserDataFromUsername(request, url.pathname, env, mapScrutineer[data.scrutineerer]);
					if (!scrutineer.success) return scrutineer.response;

					const carid = crypto.randomUUID();
					const carArray = [userid, scrutineer.response.userid, carid, derivedCarID, data.carName, maxIteration.response + 1, data.dateCreated.toISOString(), data.frontalArea, data.dragCoefficient, 0.5 * 1.196 * 225 * data.dragCoefficient * data.frontalArea / 1000000, data.changelog, data.addDetails];

					const finalUpload = await uploadCarMetadata(request, url.pathname, env, carArray);
					return finalUpload.response;
				}
				else return buildResponse('There was an unexpected error.', 405, normalHeader);
			}

			else if (url.pathname === '/api/dashboard/f3d') {
				const requestCheck = await checkRequest(url.pathname, request, ['GET', 'POST']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;
				const userid = sessionCheck.userid;
				
				if (request.method === 'GET') {
					const iterationNumberString = url.searchParams.get('iterationNumber');
					if (iterationNumberString === null) return buildResponse('There was an unexpected error.', 400, normalHeader);
					const iterationNumber = Number(iterationNumberString);
					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;
					const iterationInput = {
						name: 'iterationNumber',
						input: iterationNumber,
						requirements: {
							minValue: 0,
							maxValue: maxIteration.response,
							dataType: 'number',
							integer: true,
						}
					}

					const inputCheck = await validateInputs(url.pathname, request, [iterationInput], env);
					if (!inputCheck.success) return inputCheck.response;

					if (iterationNumber === 0) {
						const finalFetch = await pullCarFile(maxIteration.response, env, url.pathname, request);
						return finalFetch.response;
					}
					else {
						const finalFetch = await pullCarFile(iterationNumber, env, url.pathname, request);
						return finalFetch.response;
					}
				}
				else if (request.method === 'POST') {
					const requestCheck = await checkRequest(url.pathname, request, ['POST'], ['application/octet-stream']);
					if (!requestCheck.success) return requestCheck.response;

					const parseRequest = await parseRequestBlob(url.pathname, request, 100000000);
					if (!parseRequest.success) return parseRequest.response;

					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;

					const carid = url.searchParams.get('carid');
					const fileType = url.searchParams.get('fileType');

					const inputs = [{
						name: 'carid',
						input: carid,
						requirements: {
							dataType: 'string',
							minLength: 36,
							maxLength: 36,
							dbCheck: {
								statement: 'SELECT * FROM cars WHERE carid = ?',
								vars: [carid],
							}
						}
					}, {
						name: 'fileType',
						input: fileType,
						requirements: {
							minLength: 3,
							maxLength: 3,
							dataType: 'string',
							specificValues: ['f3d', 'f3z']
						}
					}];

					const inputCheck = await validateInputs(url.pathname, request, inputs, env);
					if (!inputCheck.success) return inputCheck.response;

					const fileCheck = await checkFileMagicBytes(parseRequest.blob, 'f3d/f3z');
					if (!fileCheck) return buildResponse('There was an unexpected error.', 400, normalHeader);

					return await uploadCarFile(carid, env, url.pathname, request, fileType, parseRequest.blob, userid);
				}
				else return buildResponse('There was an unexpected error.', 405, normalHeader);
			}

			else if (url.pathname === '/api/dashboard/previews') {
				const requestCheck = await checkRequest(url.pathname, request, ['POST', 'GET']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;
				const userid = sessionCheck.userid;
				
				if (request.method === 'GET') {
					const iterationNumberString = url.searchParams.get('iterationNumber');
					if (iterationNumberString === null) return buildResponse('There was an unexpected error.', 400, normalHeader);
					const iterationNumber = Number(iterationNumberString);
					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;
					const iterationInput = {
						name: 'iterationNumber',
						input: iterationNumber,
						requirements: {
							minValue: 0,
							maxValue: maxIteration.response,
							dataType: 'number',
							integer: true,
						}
					}

					const inputCheck = await validateInputs(url.pathname, request, [iterationInput], env);
					if (!inputCheck.success) return inputCheck.response;

					if (iterationNumber === 0) {
						const finalFetch = await pullCarFile(maxIteration.response, env, url.pathname, request);
						return finalFetch.response;
					}
					else {
						const finalFetch = await pullCarFile(iterationNumber, env, url.pathname, request);
						return finalFetch.response;
					}
				}
				else if (request.method === 'POST') {
					const requestCheck = await checkRequest(url.pathname, request, ['POST'], ['model/gltf-binary', 'image/png']);
					if (!requestCheck.success) return requestCheck.response;

					const parseRequest = await parseRequestBlob(url.pathname, request, 5000000);
					if (!parseRequest.success) return parseRequest.response;

					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;

					const carid = url.searchParams.get('carid');
					const fileType = url.searchParams.get('fileType');

					const inputs = [{
						name: 'carid',
						input: carid,
						requirements: {
							dataType: 'string',
							minLength: 36,
							maxLength: 36,
							dbCheck: {
								statement: 'SELECT * FROM cars WHERE carid = ?',
								vars: [carid],
							}
						}
					}, {
						name: 'fileType',
						input: fileType,
						requirements: {
							minLength: 3,
							maxLength: 3,
							dataType: 'string',
							specificValues: ['glb', 'png']
						}
					}];

					const inputCheck = await validateInputs(url.pathname, request, inputs, env);
					if (!inputCheck.success) return inputCheck.response;
					
					const fileCheck = await checkFileMagicBytes(parseRequest.blob, 'glb/png');
					if (!fileCheck) return buildResponse('There was an unexpected error.', 400, normalHeader);

					return await uploadCarFile(carid, env, url.pathname, request, fileType, parseRequest.blob, userid);
				}
				else return buildResponse('There was an unexpected error.', 405, normalHeader);
			}

			else if (url.pathname === '/api/dashboard/iso' || url.pathname === '/api/dashboard/planes') {
				const requestCheck = await checkRequest(url.pathname, request, ['POST', 'GET']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;
				const userid = sessionCheck.userid;
				
				if (request.method === 'GET') {
					const iterationNumberString = url.searchParams.get('iterationNumber');
					if (iterationNumberString === null) return buildResponse('There was an unexpected error.', 400, normalHeader);
					const iterationNumber = Number(iterationNumberString);
					const maxIteration = await identifyMaxIteration(request, url.pathname, env);
					if (!maxIteration.success) return maxIteration.response;
					const iterationInput = {
						name: 'iterationNumber',
						input: iterationNumber,
						requirements: {
							minValue: 0,
							maxValue: maxIteration.response,
							dataType: 'number',
							integer: true,
						}
					}

					const inputCheck = await validateInputs(url.pathname, request, [iterationInput], env);
					if (!inputCheck.success) return inputCheck.response;

					if (iterationNumber === 0) {
						const finalFetch = await pullCarFile(maxIteration.response, env, url.pathname, request);
						return finalFetch.response;
					}
					else {
						const finalFetch = await pullCarFile(iterationNumber, env, url.pathname, request);
						return finalFetch.response;
					}
				}
				else if (request.method === 'POST') {
					const requestCheck = await checkRequest(url.pathname, request, ['POST'], ['model/gltf-binary', 'image/png']);
					if (!requestCheck.success) return requestCheck.response;

					const parseRequest = await parseRequestBlob(url.pathname, request, 5000000);
					if (!parseRequest.success) return parseRequest.response;

					const fileCheck = await checkFileMagicBytes(parseRequest.blob, 'png');
					if (!fileCheck) return buildResponse('There was an unexpected error.', 400, normalHeader);

					const carid = url.searchParams.get('carid');
					const fileType = url.searchParams.get('fileType');

					const inputs = [{
						name: 'carid',
						input: carid,
						requirements: {
							dataType: 'string',
							minLength: 36,
							maxLength: 36,
							dbCheck: {
								statement: 'SELECT * FROM cars WHERE carid = ?',
								vars: [carid],
							}
						}
					}, {
						name: 'fileType',
						input: fileType,
						requirements: {
							minLength: 3,
							maxLength: 3,
							dataType: 'string',
							specificValues: ['png']
						}
					}];

					const inputCheck = await validateInputs(url.pathname, request, inputs, env);
					if (!inputCheck.success) return inputCheck.response;

					return await uploadCarFile(carid, env, url.pathname, request, fileType, parseRequest.blob, userid);
				}
				else return buildResponse('There was an unexpected error.', 405, normalHeader);
			}

			else if (url.pathname === '/api/change-password') {
				const requestCheck = await checkRequest(url.pathname, request, ['POST'], ['application/json']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;

				const parseRequest = await parseRequestJSON(url.pathname, request, ['currentPassword', 'newPassword']);
				if (!parseRequest.success) return parseRequest.response;

				const currentPassword = parseRequest.json.currentPassword;
				const newPassword = parseRequest.json.newPassword;

				const inputs = [{
					name: 'currentPassword',
					input: currentPassword,
					requirements: {
						dataType: 'string',
						minLength: 3,
						maxLength: 128
					}
				}, {
					name: 'newPassword',
					input: newPassword,
					requirements: {
						dataType: 'string',
						minLength: 3,
						maxLength: 128
					}
				}];

				const inputCheck = await validateInputs(url.pathname, request, inputs, env, true);
				if (!inputCheck.success) return inputCheck.response;

				const userid = sessionCheck.userid;
				const userData = await fetchUserDataFromUserID(request, url.pathname, env, userid);
				if (!userData.success) return userData.response;

				const authentication = await authenticate(userData.response.username, currentPassword, env, url.pathname, request);
				if (authentication.allow) {
					const passwordChange = await updatePassword(userid, env, newPassword, url.pathname, request);
					if (!passwordChange.success) return passwordChange.response;
					else return await deleteAllSessionTokens(userid, env, url.pathname, request, sessionCheck.sessionToken);
				}
				else return authentication.response;
			}

			else if (url.pathname === '/api/clear-all-sessions') {
				const requestCheck = await checkRequest(url.pathname, request, ['POST']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;

				const userid = sessionCheck.userid;
				const sessionToken = sessionCheck.sessionToken;
				const deletion = await deleteAllSessionTokens(userid, env, url.pathname, request, sessionToken);
				return deletion.response;
			}

			else if (url.pathname === '/api/logout') {
				const requestCheck = await checkRequest(url.pathname, request, ['POST']);
				if (!requestCheck.success) return requestCheck.response;

				const handleIP = await handleIPBan(url.pathname, request, env);
				if (!handleIP.allow) return handleIP.response;

				const sessionCheck = await checkSession(request, url.pathname, env);
				if (!sessionCheck.allow) return sessionCheck.response;

				const sessionToken = sessionCheck.sessionToken;
				const deletion = await deleteSessionToken(sessionToken, env, url.pathname, request);
				return deletion.response;
			}

			else return buildResponse('Not Found', 404, normalHeader);
		}
		catch (error) {
			log('error', url.pathname, request, 'Unexpected error thrown, uncaught by all functions.', error)
			return buildResponse('There was an unexpected error.', 500, normalHeader);
		}
	},

	async scheduled(event, env, ctx) {
		const now = new Date().toISOString();

		try {
			const query = env.blitz.prepare('DELETE FROM sessiontokens WHERE expiration_date < ?').bind(now);
			await query.run();
			console.log('Performed automatic session token cleanup.');
		}
		catch (error) {
			const errorStack = error instanceof Error
				? {
					name: error.name,
					message: error.message,
					stack: error.stack
				}
				: error;

			console.error({
				timestamp: new Date().toISOString(),
				message: 'Automatic session token cleanup failed.',
				errorStack: errorStack
			});
		}
	}
}