import { d365Fetch } from "./d365";
import type { Context, Next } from "hono";

const JWKS_CACHE_KEY = "cf_access_jwks";

interface JWK {
	kid: string;
	kty: string;
	alg: string;
	use: string;
	n: string;
	e: string;
}

interface JWKSResponse {
	keys: JWK[];
}

export interface PortalUser {
	email: string;
	contactId: string;
	name: string;
	isInternal: boolean;
	accountName: string | null;
}

function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const b64 = padded + "=".repeat(padLen);
	const binary = atob(b64);
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getJWKS(env: Env): Promise<JWK[]> {
	const cached = await env.KV.get(JWKS_CACHE_KEY, "json") as JWKSResponse | null;
	if (cached) return cached.keys;

	const res = await fetch(
		`https://${env.CF_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/certs`
	);
	if (!res.ok) throw new Error("Failed to fetch Cloudflare Access JWKS");

	const jwks = await res.json() as JWKSResponse;
	// Cache for 1 hour
	await env.KV.put(JWKS_CACHE_KEY, JSON.stringify(jwks), { expirationTtl: 3600 });
	return jwks.keys;
}

async function importRSAKey(jwk: JWK): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"jwk",
		{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg, use: jwk.use },
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"]
	);
}

export async function verifyAccessJWT(
	token: string,
	env: Env
): Promise<{ email: string } | null> {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
		const payload = JSON.parse(
			new TextDecoder().decode(base64UrlDecode(parts[1]))
		);

		// Check expiry
		if (payload.exp < Math.floor(Date.now() / 1000)) return null;

		// Check audience
		const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
		if (!aud.includes(env.CF_ACCESS_AUD)) return null;

		// Find matching key
		const keys = await getJWKS(env);
		const jwk = keys.find((k) => k.kid === header.kid);
		if (!jwk) return null;

		// Verify signature
		const cryptoKey = await importRSAKey(jwk);
		const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
		const signature = base64UrlDecode(parts[2]);
		const valid = await crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			cryptoKey,
			signature,
			signedData
		);

		if (!valid) return null;
		return { email: payload.email };
	} catch {
		return null;
	}
}

export async function lookupPortalUser(
	email: string,
	env: Env
): Promise<PortalUser | null> {
	const isInternal = email.toLowerCase().endsWith("@packetfusion.com");

	if (isInternal) {
		return { email, contactId: "", name: email, isInternal: true, accountName: "Packet Fusion" };
	}

	const filter = `emailaddress1 eq '${email}' and vtx_portaluser eq true`;
	const select = "contactid,fullname,emailaddress1";
	const expand = "parentcustomerid_account($select=name)";
	const res = await d365Fetch(
		env,
		`/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}&$expand=${encodeURIComponent(expand)}&$top=1`
	);

	if (!res.ok) return null;

	const data = await res.json() as { value: { contactid: string; fullname: string; parentcustomerid_account?: { name: string } }[] };
	if (!data.value.length) return null;

	const contact = data.value[0];
	return {
		email,
		contactId: contact.contactid,
		name: contact.fullname,
		isInternal: false,
		accountName: contact.parentcustomerid_account?.name ?? null,
	};
}

function getCookieValue(cookieHeader: string, name: string): string | undefined {
	const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
	return match ? match.slice(name.length + 1) : undefined;
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user: PortalUser } }>, next: Next) {
	const sessionId = getCookieValue(c.req.header("cookie") ?? "", "pf_session");
	if (!sessionId) return c.json({ error: "Unauthorized" }, 401);

	const raw = await c.env.KV.get(`session:${sessionId}`);
	if (!raw) return c.json({ error: "Unauthorized" }, 401);

	c.set("user", JSON.parse(raw) as PortalUser);
	await next();
}
