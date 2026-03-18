const D365_BASE_URL = "https://packetfusioncrm.crm.dynamics.com";
const TOKEN_CACHE_KEY = "d365_access_token";

interface TokenResponse {
	access_token: string;
	expires_in: number;
}

export async function getD365Token(env: Env): Promise<string> {
	const cached = await env.KV.get(TOKEN_CACHE_KEY);
	if (cached) return cached;

	const params = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: env.D365_CLIENT_ID,
		client_secret: env.D365_CLIENT_SECRET,
		scope: `${D365_BASE_URL}/.default`,
	});

	const res = await fetch(
		`https://login.microsoftonline.com/${env.D365_TENANT_ID}/oauth2/v2.0/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		}
	);

	if (!res.ok) {
		const error = await res.text();
		throw new Error(`D365 token fetch failed: ${error}`);
	}

	const data = (await res.json()) as TokenResponse;

	// Cache with 5 minute buffer before actual expiry
	await env.KV.put(TOKEN_CACHE_KEY, data.access_token, {
		expirationTtl: data.expires_in - 300,
	});

	return data.access_token;
}

export async function d365Fetch(
	env: Env,
	path: string,
	options: RequestInit = {}
): Promise<Response> {
	const token = await getD365Token(env);

	return fetch(`${D365_BASE_URL}/api/data/v9.2${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"OData-MaxVersion": "4.0",
			"OData-Version": "4.0",
			Accept: "application/json",
			"Content-Type": "application/json",
			...options.headers,
		},
	});
}
