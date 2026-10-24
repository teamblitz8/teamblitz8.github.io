const corsHeaders = {
	'Access-Control-Allow-Origin': 'https://teamblitz.pages.dev',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

const encoder = new TextEncoder();

const compare = (a, b) => {
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

export default {
	async fetch(request, env, ctx) {
		const ipQuery = env.blitz.prepare('SELECT ip FROM ipbans');
		const ipQueryResults = await ipQuery.run();
		const banList = ipQueryResults.results;
		const ip = request.headers.get('cf-connecting-ip');
		const { pathname } = new URL(request.url);

		if (banList.length !== 0) {
			for (let i of banList) {
				if (i.ip === ip) {
					return new Response(429, { status: 429, headers: corsHeaders });
				}
			}
		}

		const { success } = await env.ratelimiter.limit({ key: pathname });

		if (!success) {
			const currentDate = (new Date()).toISOString();
			const push = env.blitz.prepare(`INSERT INTO ipbans (ip, date_banned) VALUES (?, ?);`).bind(ip, currentDate);
			await push.run();
			const check = env.blitz.prepare('SELECT ip from ipbans WHERE date_banned = ?;').bind(currentDate);
			const checkResults = await check.run();

			if (checkResults.results[0].ip === ip) {
				console.log(`New IP banned: ${ip}`);
				return new Response(429, { status: 429, headers: corsHeaders });
			}
			else {
				console.log('IP couldn\'t be banned. Check database.');
				return new Response(500, { status: 500, headers: corsHeaders })
			}
		}

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			const hasher = require('../hasher.js');
			const reqJson = await request.json();

			if (pathname === '/api/auth/') {
				const enteredUsername = reqJson.username;
				const enteredPassword = reqJson.password;
				const query = env.blitz.prepare('SELECT username, password_hash, password_salt, active FROM users WHERE username = ?').bind(enteredUsername);
				const result = await query.run();
				if (!result.results || result.results.length === 0) {
					const fakeHash = hasher.hash('676767676767').hash;
					compare(fakeHash, fakeHash);
					return new Response(401, { status: 401, headers: corsHeaders });
				}

				const passwordHash = result.results[0]['password_hash'];
				const passwordSalt = Buffer.from(result.results[0]['password_salt'], 'hex');
				const active = result.results[0]['active'];
				
				const hashedAttempt = hasher.hash(enteredPassword, passwordSalt).hash;
				const isCorrect = compare(hashedAttempt, passwordHash);

				if (isCorrect) {
					if (active) {
						return new Response(200, { status: 200, headers: corsHeaders });
					}
					else {
						return new Response(403, { status: 403, headers: corsHeaders });
					}
				}
				else {
					return new Response(401, { status: 401, headers: corsHeaders });
				}
			}
			else if (pathname === '/api/cars/') {
				// do something
			}
			else {
				return new Response(404, { status: 404, headers: corsHeaders });
			}
		}
		catch (e) {
			console.error(e);
			return new Response(500, { status: 500, headers: corsHeaders });
		}
	},
};
