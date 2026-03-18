import { Hono } from "hono";
import { d365Fetch } from "../d365";
import type { PortalUser } from "../auth";

type Variables = { user: PortalUser };

const accounts = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/portal/accounts?search=q — internal only
accounts.get("/", async (c) => {
	const user = c.get("user");
	if (!user.isInternal) return c.json({ error: "Forbidden" }, 403);

	const search = c.req.query("search") ?? "";
	if (search.length < 2) return c.json([]);

	const filter = `contains(name,'${search.replace(/'/g, "''")}')`;
	const res = await d365Fetch(
		c.env,
		`/accounts?$filter=${encodeURIComponent(filter)}&$select=accountid,name&$top=15&$orderby=name`
	);

	if (!res.ok) return c.json([]);

	const data = await res.json() as { value: any[] };
	return c.json(data.value.map((a: any) => ({ id: a.accountid, name: a.name })));
});

// GET /api/portal/accounts/:id/contacts — internal only
accounts.get("/:id/contacts", async (c) => {
	const user = c.get("user");
	if (!user.isInternal) return c.json({ error: "Forbidden" }, 403);

	const { id } = c.req.param();
	const res = await d365Fetch(
		c.env,
		`/contacts?$filter=_parentcustomerid_value eq '${id}'&$select=contactid,fullname,emailaddress1&$orderby=fullname`
	);

	if (!res.ok) return c.json([]);

	const data = await res.json() as { value: any[] };
	return c.json(data.value.map((ct: any) => ({
		id: ct.contactid,
		name: ct.fullname,
		email: ct.emailaddress1,
	})));
});

export default accounts;
