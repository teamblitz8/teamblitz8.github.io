const corsHeaders = {
	'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
	async fetch(request, env, ctx) {
		const hasher = require('../hasher.js');
		const { pathname } = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		const reqJson = await request.json();

		if (pathname === '/api/auth/') {
			const enteredUsername = reqJson.username;
			const enteredPassword = reqJson.password;
			const query = env.blitz.prepare('SELECT username, password_hash, password_salt FROM users WHERE username = ?').bind(enteredUsername);
			const result = await query.run();
			if (!result.results) {
				return Response.json({ status: 401, headers: corsHeaders });
			}

			const passwordHash = result.results[0]['password_hash'];
			const passwordSalt = result.results[0]['password_salt'];
			
			const hashedAttempt = hasher.hash(enteredPassword, passwordSalt).hash;
			if (hashedAttempt === passwordHash) {
				return Response.json({ status: 200, headers: corsHeaders });
			}
			else {
				return Response.json({ status: 401, headers: corsHeaders });
			}
		}
		else {
			return new Response("Not Found", {
				status: 404,
				headers: corsHeaders
			});
		}
	},
};
