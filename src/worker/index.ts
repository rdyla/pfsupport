import { Hono } from "hono";
import { authMiddleware, type PortalUser } from "./auth";
import casesRouter from "./routes/cases";
import kbRouter from "./routes/kb";
import accountsRouter from "./routes/accounts";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import { d365Fetch } from "./d365";

type Variables = { user: PortalUser };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth routes (public — no middleware)
app.route("/api/auth", authRouter);

// Legacy redirect — old provider sends users here
app.get("/Login.aspx", (c) => c.redirect("/", 301));

// Welcome page (public)
app.get("/", (c) =>
	c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)))
);

// Login page (public)
app.get("/login", (c) =>
	c.env.ASSETS.fetch(new Request(new URL("/login.html", c.req.url)))
);

// SPA fallback — serve the React shell for any /portal/* route not matched by a static asset
app.get("/portal", (c) =>
	c.env.ASSETS.fetch(new Request(new URL("/portal/index.html", c.req.url)))
);
app.get("/portal/*", (c) =>
	c.env.ASSETS.fetch(new Request(new URL("/portal/index.html", c.req.url)))
);

// Auth middleware for all portal routes
app.use("/api/portal/*", authMiddleware);

// Current user info
app.get("/api/portal/me", (c) => c.json(c.get("user")));

// Customer's own account contacts (for notification contact picker)
app.get("/api/portal/me/contacts", async (c) => {
	const user = c.get("user");
	if (!user.contactId) return c.json([]);
	const contactRes = await d365Fetch(c.env, `/contacts(${user.contactId})?$select=_parentcustomerid_value`);
	if (!contactRes.ok) return c.json([]);
	const { _parentcustomerid_value: accountId } = await contactRes.json() as { _parentcustomerid_value: string };
	if (!accountId) return c.json([]);
	const res = await d365Fetch(c.env, `/contacts?$filter=_parentcustomerid_value eq '${accountId}'&$select=contactid,fullname,emailaddress1&$orderby=fullname`);
	if (!res.ok) return c.json([]);
	const data = await res.json() as { value: any[] };
	return c.json(data.value.map((ct: any) => ({ id: ct.contactid, name: ct.fullname, email: ct.emailaddress1 })));
});

// Customer's sold technology vendors (for vendor KB search)
app.get("/api/portal/me/vendors", async (c) => {
	const user = c.get("user");
	if (!user.accountId) return c.json([]);

	const res = await d365Fetch(c.env,
		`/am_soldtechnologies?$filter=_am_account_value eq '${user.accountId}'&$select=_am_vendor_value&$top=50`,
		{ headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' } }
	);
	if (!res.ok) return c.json([]);

	const data = await res.json() as { value: Record<string, string>[] };
	const names = data.value
		.map(v => v["_am_vendor_value@OData.Community.Display.V1.FormattedValue"])
		.filter(Boolean);
	return c.json([...new Set(names)]);
});

// Cases routes
app.route("/api/portal/cases", casesRouter);

// Knowledge base routes
app.route("/api/portal/kb", kbRouter);

// Accounts + contacts lookup
app.route("/api/portal/accounts", accountsRouter);

// Internal user search (for escalation engineer picker)
app.route("/api/portal/users", usersRouter);

// Dev/test endpoints
app.get("/api/test", (c) => c.json({ ok: true }));
app.get("/api/d365/ping", async (c) => {
	const res = await d365Fetch(c.env, "/incidents?$top=1&$select=ticketnumber");
	if (!res.ok) return c.json({ error: await res.text() }, res.status as any);
	return c.json({ ok: true, data: await res.json() });
});

export default app;
