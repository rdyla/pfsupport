import { Hono } from "hono";
import { d365Fetch } from "../d365";
import type { PortalUser } from "../auth";

type Variables = { user: PortalUser };

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/portal/users?search=q — internal only, searches D365 system users
users.get("/", async (c) => {
	const user = c.get("user");
	if (!user.isInternal) return c.json({ error: "Forbidden" }, 403);

	const search = c.req.query("search") ?? "";
	if (search.length < 2) return c.json([]);

	const filter = `contains(fullname,'${search.replace(/'/g, "''")}') and isdisabled eq false`;
	const res = await d365Fetch(
		c.env,
		`/systemusers?$filter=${encodeURIComponent(filter)}&$select=systemuserid,fullname,internalemailaddress&$top=15&$orderby=fullname`
	);

	if (!res.ok) return c.json([]);

	const data = await res.json() as { value: any[] };
	return c.json(data.value.map((u: any) => ({
		id: u.systemuserid,
		name: u.fullname,
		email: u.internalemailaddress,
	})));
});

export default users;
