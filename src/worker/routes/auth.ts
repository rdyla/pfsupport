import { Hono } from "hono";
import { lookupPortalUser } from "../auth";

const router = new Hono<{ Bindings: Env }>();

const GRAPH_TOKEN_CACHE_KEY = "graph_token";
const FROM_ADDRESS = "supportportal@packetfusion.com";
const SESSION_TTL = 60 * 60 * 8; // 8 hours
const OTP_TTL = 60 * 10;         // 10 minutes
const OTP_RATE_TTL = 60;         // 1 minute between resend attempts
const MAX_ATTEMPTS = 5;

// ── Microsoft Graph token ────────────────────────────────────────────────────

async function getGraphToken(env: Env): Promise<string> {
	const cached = await env.KV.get(GRAPH_TOKEN_CACHE_KEY);
	if (cached) return cached;

	const params = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: env.D365_CLIENT_ID,
		client_secret: env.D365_CLIENT_SECRET,
		scope: "https://graph.microsoft.com/.default",
	});

	const res = await fetch(
		`https://login.microsoftonline.com/${env.D365_TENANT_ID}/oauth2/v2.0/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		}
	);

	if (!res.ok) throw new Error(`Graph token fetch failed: ${await res.text()}`);

	const data = await res.json() as { access_token: string; expires_in: number };
	await env.KV.put(GRAPH_TOKEN_CACHE_KEY, data.access_token, {
		expirationTtl: data.expires_in - 300,
	});
	return data.access_token;
}

// ── Email sending ────────────────────────────────────────────────────────────

async function sendOTPEmail(env: Env, toEmail: string, code: string): Promise<void> {
	const token = await getGraphToken(env);

	const res = await fetch(
		`https://graph.microsoft.com/v1.0/users/${FROM_ADDRESS}/sendMail`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message: {
					subject: "Your Packet Fusion Support Portal Sign-In Code",
					body: {
						contentType: "HTML",
						content: `
							<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
								<div style="background:#1b3d6e;padding:24px 32px">
									<img src="https://support.packetfusion.com/packetfusionlogo_white.png" alt="Packet Fusion" style="height:48px"/>
								</div>
								<div style="padding:32px;border:1px solid #e5e7eb;border-top:none">
									<h2 style="margin:0 0 8px;color:#1b3d6e;font-size:20px">Your sign-in code</h2>
									<p style="margin:0 0 24px;color:#4a5568;font-size:15px">
										Use the code below to sign in to the Packet Fusion Support Portal.
										It expires in <strong>10 minutes</strong>.
									</p>
									<div style="background:#f0f4f8;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
										<span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1b3d6e">${code}</span>
									</div>
									<p style="margin:0;color:#718096;font-size:13px">
										If you didn't request this code, you can safely ignore this email.
										Someone may have entered your email address by mistake.
									</p>
								</div>
								<div style="padding:16px 32px;text-align:center">
									<p style="margin:0;color:#a0aec0;font-size:12px">
										© 2026 Packet Fusion · 4637 Chabot Drive, Suite 350, Pleasanton, CA 94588
									</p>
								</div>
							</div>
						`,
					},
					toRecipients: [{ emailAddress: { address: toEmail } }],
				},
			}),
		}
	);

	if (!res.ok) throw new Error(`Graph sendMail failed: ${await res.text()}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateOTP(): string {
	return String(Math.floor(100000 + Math.random() * 900000));
}

function otpKey(email: string) { return `otp:${email.toLowerCase()}`; }
function otpRateKey(email: string) { return `otp_rate:${email.toLowerCase()}`; }
function sessionKey(id: string) { return `session:${id}`; }

function sessionCookie(id: string, maxAge: number) {
	return `pf_session=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/send-otp
router.post("/send-otp", async (c) => {
	const { email } = await c.req.json<{ email: string }>();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return c.json({ error: "Invalid email address" }, 400);
	}

	// Rate limit: one OTP request per minute per email
	const rateLimited = await c.env.KV.get(otpRateKey(email));
	if (rateLimited) {
		return c.json({ error: "Please wait a moment before requesting another code" }, 429);
	}

	const code = generateOTP();
	await c.env.KV.put(otpKey(email), JSON.stringify({ code, attempts: 0 }), { expirationTtl: OTP_TTL });
	await c.env.KV.put(otpRateKey(email), "1", { expirationTtl: OTP_RATE_TTL });

	await sendOTPEmail(c.env, email, code);

	return c.json({ ok: true });
});

// POST /api/auth/verify
router.post("/verify", async (c) => {
	const { email, code } = await c.req.json<{ email: string; code: string }>();
	if (!email || !code) return c.json({ error: "Missing email or code" }, 400);

	const raw = await c.env.KV.get(otpKey(email));
	if (!raw) return c.json({ error: "Code expired or not found — please request a new one" }, 401);

	const stored = JSON.parse(raw) as { code: string; attempts: number };

	if (stored.attempts >= MAX_ATTEMPTS) {
		await c.env.KV.delete(otpKey(email));
		return c.json({ error: "Too many attempts — please request a new code" }, 401);
	}

	if (stored.code !== code.trim()) {
		stored.attempts++;
		await c.env.KV.put(otpKey(email), JSON.stringify(stored), { expirationTtl: OTP_TTL });
		return c.json({ error: "Incorrect code — please try again" }, 401);
	}

	// Code is valid — clean up OTP
	await c.env.KV.delete(otpKey(email));

	// Look up portal user
	const user = await lookupPortalUser(email, c.env);
	if (!user) {
		return c.json({ error: "No portal access found for this email address. Contact support@packetfusion.com for help." }, 403);
	}

	// Create session
	const sessionId = crypto.randomUUID();
	await c.env.KV.put(sessionKey(sessionId), JSON.stringify(user), { expirationTtl: SESSION_TTL });

	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			"Content-Type": "application/json",
			"Set-Cookie": sessionCookie(sessionId, SESSION_TTL),
		},
	});
});

// GET /api/auth/logout
router.get("/logout", async (c) => {
	const cookieHeader = c.req.header("cookie") ?? "";
	const match = cookieHeader.split(";").map(s => s.trim()).find(s => s.startsWith("pf_session="));
	const sessionId = match ? match.slice("pf_session=".length) : null;

	if (sessionId) await c.env.KV.delete(sessionKey(sessionId));

	return new Response(null, {
		status: 302,
		headers: {
			Location: "/login",
			"Set-Cookie": sessionCookie("", 0),
		},
	});
});

export default router;
