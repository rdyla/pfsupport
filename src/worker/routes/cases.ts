import { Hono } from "hono";
import { d365Fetch } from "../d365";
import type { PortalUser } from "../auth";

type Variables = { user: PortalUser };

const cases = new Hono<{ Bindings: Env; Variables: Variables }>();

const PRIORITY_MAP: Record<number, string> = { 1: "High", 2: "Normal", 3: "Low" };
const STATUS_MAP: Record<number, string> = {
	1: "In Progress",
	2: "On Hold",
	5: "Problem Solved",
	1000: "Information Provided",
};
const STATE_MAP: Record<number, string> = { 0: "Active", 1: "Resolved", 2: "Cancelled" };

async function getAccountId(contactId: string, env: Env): Promise<string | null> {
	const res = await d365Fetch(
		env,
		`/contacts(${contactId})?$select=_parentcustomerid_value`
	);
	if (!res.ok) return null;
	const data = await res.json() as { _parentcustomerid_value: string };
	return data._parentcustomerid_value ?? null;
}

// GET /api/portal/cases
cases.get("/", async (c) => {
	const user = c.get("user");
	const search = c.req.query("search")?.trim() ?? "";

	let filter: string;
	if (user.isInternal) {
		const baseFilter = "statecode ge 0";
		if (search) {
			const s = search.replace(/'/g, "''");
			filter = `(${baseFilter}) and (contains(ticketnumber,'${s}') or contains(title,'${s}') or contains(description,'${s}'))`;
		} else {
			filter = baseFilter;
		}
	} else {
		const accountId = await getAccountId(user.contactId, c.env);
		if (!accountId) {
			return c.json({ error: "Could not determine account" }, 400);
		}
		const baseFilter = `(_customerid_value eq '${accountId}' or _customerid_value eq '${user.contactId}')`;
		if (search) {
			const s = search.replace(/'/g, "''");
			filter = `${baseFilter} and (contains(ticketnumber,'${s}') or contains(title,'${s}'))`;
		} else {
			filter = `_customerid_value eq '${accountId}' or _customerid_value eq '${user.contactId}'`;
		}
	}

	const top = search ? 100 : 500;
	const select = "incidentid,ticketnumber,title,prioritycode,statuscode,statecode,createdon,_customerid_value";
	const expand = "owninguser($select=fullname)";
	const res = await d365Fetch(
		c.env,
		`/incidents?$filter=${encodeURIComponent(filter)}&$select=${select}&$expand=${expand}&$orderby=createdon desc&$top=${top}`,
		{ headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' } }
	);

	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}

	const data = await res.json() as { value: any[] };
	const mapped = data.value.map((r: any) => ({
		id: r.incidentid,
		ticketNumber: r.ticketnumber,
		title: r.title,
		priority: PRIORITY_MAP[r.prioritycode] ?? "Normal",
		status: r.statecode === 0 ? (STATUS_MAP[r.statuscode] ?? "In Progress") : (STATE_MAP[r.statecode] ?? "Resolved"),
		state: STATE_MAP[r.statecode] ?? "Active",
		createdOn: r.createdon,
		owner: r.owninguser?.fullname ?? null,
		accountName: r["_customerid_value@OData.Community.Display.V1.FormattedValue"] ?? null,
	}));

	return c.json(mapped);
});

// GET /api/portal/cases/:id
cases.get("/:id", async (c) => {
	const { id } = c.req.param();

	const select = "incidentid,ticketnumber,title,description,prioritycode,statuscode,statecode,createdon,_customerid_value,_primarycontactid_value,_amc_notificationcontact1_value,_am_escalationengineer_value";
	const expand = "owninguser($select=fullname)";
	const res = await d365Fetch(c.env, `/incidents(${id})?$select=${select}&$expand=${expand}`,
		{ headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' } });

	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}

	const raw = await res.json() as any;
	const caseData = {
		id: raw.incidentid,
		ticketNumber: raw.ticketnumber,
		title: raw.title,
		description: raw.description,
		priority: PRIORITY_MAP[raw.prioritycode] ?? "Normal",
		status: raw.statecode === 0 ? (STATUS_MAP[raw.statuscode] ?? "In Progress") : (STATE_MAP[raw.statecode] ?? "Resolved"),
		state: STATE_MAP[raw.statecode] ?? "Active",
		statecode: raw.statecode as number,
		statuscode: raw.statuscode as number,
		createdOn: raw.createdon,
		owner: raw.owninguser?.fullname ?? null,
		accountId: raw._customerid_value ?? null,
		accountName: raw["_customerid_value@OData.Community.Display.V1.FormattedValue"] ?? null,
		primaryContactId: raw._primarycontactid_value ?? null,
		primaryContactName: raw["_primarycontactid_value@OData.Community.Display.V1.FormattedValue"] ?? null,
		notificationContactId: raw._amc_notificationcontact1_value ?? null,
		notificationContactName: raw["_amc_notificationcontact1_value@OData.Community.Display.V1.FormattedValue"] ?? null,
		escalationEngineerId: raw._am_escalationengineer_value ?? null,
		escalationEngineerName: raw["_am_escalationengineer_value@OData.Community.Display.V1.FormattedValue"] ?? null,
	};

	// Fetch annotations — expand createdby to get the author name
	const annotSelect = "annotationid,subject,notetext,filename,mimetype,isdocument,createdon,filesize";
	const annotExpand = "createdby($select=fullname)";
	const annotRes = await d365Fetch(
		c.env,
		`/annotations?$filter=_objectid_value eq '${id}'&$select=${annotSelect}&$expand=${annotExpand}&$orderby=createdon asc`
	);

	let notes: any[] = [];
	if (annotRes.ok) {
		const annotData = await annotRes.json() as { value: any[] };
		notes = annotData.value.map((n: any) => ({
			id: n.annotationid,
			subject: n.subject,
			text: n.notetext,
			isAttachment: n.isdocument,
			filename: n.filename,
			mimetype: n.mimetype,
			filesize: n.filesize,
			createdOn: n.createdon,
			createdBy: n.createdby?.fullname ?? "Unknown",
		}));
	}

	return c.json({ ...caseData, notes });
});

// POST /api/portal/cases
cases.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json() as { title: string; description: string; prioritycode: number; accountId?: string; primaryContactId?: string; notificationContactId?: string; escalationEngineerId?: string };

	if (!body.title || !body.description) {
		return c.json({ error: "Title and description are required" }, 400);
	}

	const payload: any = {
		title: body.title,
		description: body.description,
		prioritycode: body.prioritycode ?? 2,
	};

	if (user.isInternal) {
		if (body.accountId) {
			payload["customerid_account@odata.bind"] = `/accounts(${body.accountId})`;
		}
		if (body.primaryContactId) {
			payload["primarycontactid@odata.bind"] = `/contacts(${body.primaryContactId})`;
		}
		if (body.notificationContactId) {
			payload["amc_notificationcontact1@odata.bind"] = `/contacts(${body.notificationContactId})`;
		}
		if (body.escalationEngineerId) {
			payload["am_escalationengineer@odata.bind"] = `/systemusers(${body.escalationEngineerId})`;
		}
	} else {
		// Customer: set primary contact to themselves
		payload["primarycontactid@odata.bind"] = `/contacts(${user.contactId})`;
		const accountId = await getAccountId(user.contactId, c.env);
		if (accountId) {
			payload["customerid_account@odata.bind"] = `/accounts(${accountId})`;
		} else {
			payload["customerid_contact@odata.bind"] = `/contacts(${user.contactId})`;
		}
	}

	const res = await d365Fetch(c.env, "/incidents", {
		method: "POST",
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}

	const entityId = res.headers.get("OData-EntityId") ?? "";
	const match = entityId.match(/\(([^)]+)\)$/);
	if (!match) return c.json({ error: "Case created but could not determine ID" }, 500);

	const newId = match[1];

	// PATCH title + description — CRM plugin on create clears these fields
	await d365Fetch(c.env, `/incidents(${newId})`, {
		method: "PATCH",
		body: JSON.stringify({ title: payload.title, description: payload.description }),
	});

	// Add a note recording who submitted the case via the portal
	await d365Fetch(c.env, "/annotations", {
		method: "POST",
		body: JSON.stringify({
			subject: "Case submitted via Support Portal",
			notetext: `Submitted by ${user.name} (${user.email})`,
			"objectid_incident@odata.bind": `/incidents(${newId})`,
		}),
	});

	const fetchRes = await d365Fetch(c.env, `/incidents(${newId})?$select=incidentid,ticketnumber`);
	const created = fetchRes.ok ? await fetchRes.json() as any : {};
	return c.json({ id: newId, ticketNumber: created.ticketnumber ?? "" }, 201);
});

// POST /api/portal/cases/:id/notes
cases.post("/:id/notes", async (c) => {
	const { id } = c.req.param();
	const user = c.get("user");
	const body = await c.req.json() as { text: string };

	if (!body.text?.trim()) {
		return c.json({ error: "Note text is required" }, 400);
	}

	const res = await d365Fetch(c.env, "/annotations", {
		method: "POST",
		body: JSON.stringify({
			subject: `Note from ${user.name}`,
			notetext: body.text,
			"objectid_incident@odata.bind": `/incidents(${id})`,
		}),
	});

	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}

	return c.json({ ok: true }, 201);
});

// POST /api/portal/cases/:id/attachments
cases.post("/:id/attachments", async (c) => {
	const { id } = c.req.param();
	const user = c.get("user");
	const body = await c.req.json() as {
		filename: string;
		mimetype: string;
		documentbody: string;
		notetext?: string;
	};

	if (!body.filename || !body.documentbody) {
		return c.json({ error: "filename and documentbody are required" }, 400);
	}

	const res = await d365Fetch(c.env, "/annotations", {
		method: "POST",
		body: JSON.stringify({
			subject: `Attachment from ${user.name}`,
			filename: body.filename,
			mimetype: body.mimetype,
			documentbody: body.documentbody,
			notetext: body.notetext ?? "",
			isdocument: true,
			"objectid_incident@odata.bind": `/incidents(${id})`,
		}),
	});

	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}

	return c.json({ ok: true }, 201);
});

// POST /api/portal/cases/:id/status
cases.post("/:id/status", async (c) => {
	const { id } = c.req.param();
	const user = c.get("user");
	const body = await c.req.json() as { action: string; comment?: string };

	let res: Response;

	if (body.action === "resolve") {
		// D365 requires the CloseIncident action to resolve a case
		// IncidentResolution accepts: subject, description — NOT notetext
		res = await d365Fetch(c.env, "/CloseIncident", {
			method: "POST",
			body: JSON.stringify({
				IncidentResolution: {
					"incidentid@odata.bind": `/incidents(${id})`,
					subject: "Resolved via Support Portal",
					description: body.comment || "",
				},
				Status: -1,
			}),
		});
	} else if (body.action === "reopen") {
		res = await d365Fetch(c.env, `/incidents(${id})`, {
			method: "PATCH",
			body: JSON.stringify({ statecode: 0, statuscode: 1 }),
		});
	} else if (body.action === "hold") {
		res = await d365Fetch(c.env, `/incidents(${id})`, {
			method: "PATCH",
			body: JSON.stringify({ statuscode: 2 }),
		});
	} else if (body.action === "in-progress") {
		res = await d365Fetch(c.env, `/incidents(${id})`, {
			method: "PATCH",
			body: JSON.stringify({ statuscode: 1 }),
		});
	} else if (body.action === "cancel" && user.isInternal) {
		res = await d365Fetch(c.env, `/incidents(${id})`, {
			method: "PATCH",
			body: JSON.stringify({ statecode: 2, statuscode: 6 }),
		});
	} else {
		return c.json({ error: "Invalid action" }, 400);
	}

	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}

	// Add a note recording the status change
	if (body.comment) {
		await d365Fetch(c.env, "/annotations", {
			method: "POST",
			body: JSON.stringify({
				subject: `Status updated by ${user.name}`,
				notetext: body.comment,
				"objectid_incident@odata.bind": `/incidents(${id})`,
			}),
		});
	}

	return c.json({ ok: true });
});

// PATCH /api/portal/cases/:id/contacts — update notification contact + escalation engineer
cases.patch("/:id/contacts", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json() as { primaryContactId?: string | null; notificationContactId?: string | null; escalationEngineerId?: string | null };

	const payload: any = {};
	if ("primaryContactId" in body) {
		if (body.primaryContactId) {
			payload["primarycontactid@odata.bind"] = `/contacts(${body.primaryContactId})`;
		} else {
			payload["primarycontactid"] = null;
		}
	}
	if ("notificationContactId" in body) {
		if (body.notificationContactId) {
			payload["amc_notificationcontact1@odata.bind"] = `/contacts(${body.notificationContactId})`;
		} else {
			payload["amc_notificationcontact1"] = null;
		}
	}
	if ("escalationEngineerId" in body) {
		if (body.escalationEngineerId) {
			payload["am_escalationengineer@odata.bind"] = `/systemusers(${body.escalationEngineerId})`;
		} else {
			payload["am_escalationengineer"] = null;
		}
	}

	const res = await d365Fetch(c.env, `/incidents(${id})`, { method: "PATCH", body: JSON.stringify(payload) });
	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}
	return c.json({ ok: true });
});

// GET /api/portal/cases/:id/contacts — notification contacts
cases.get("/:id/contacts", async (c) => {
	const { id } = c.req.param();
	const res = await d365Fetch(
		c.env,
		`/incidents(${id})/incident_customer_contacts?$select=contactid,fullname,emailaddress1&$orderby=fullname`
	);
	if (!res.ok) return c.json([]);
	const data = await res.json() as { value: any[] };
	return c.json(data.value.map((ct: any) => ({
		id: ct.contactid,
		name: ct.fullname,
		email: ct.emailaddress1,
	})));
});

// POST /api/portal/cases/:id/contacts — add notification contact
cases.post("/:id/contacts", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json() as { contactId: string };
	if (!body.contactId) return c.json({ error: "contactId required" }, 400);

	const res = await d365Fetch(
		c.env,
		`/incidents(${id})/incident_customer_contacts/$ref`,
		{
			method: "POST",
			body: JSON.stringify({
				"@odata.id": `https://packetfusioncrm.crm.dynamics.com/api/data/v9.2/contacts(${body.contactId})`,
			}),
		}
	);
	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}
	return c.json({ ok: true });
});

// DELETE /api/portal/cases/:id/contacts/:contactId — remove notification contact
cases.delete("/:id/contacts/:contactId", async (c) => {
	const { id, contactId } = c.req.param();
	const res = await d365Fetch(
		c.env,
		`/incidents(${id})/incident_customer_contacts(${contactId})/$ref`,
		{ method: "DELETE" }
	);
	if (!res.ok) {
		const error = await res.text();
		return c.json({ error }, res.status as any);
	}
	return c.json({ ok: true });
});

// GET /api/portal/cases/:id/attachments/:annotId/download
cases.get("/:id/attachments/:annotId/download", async (c) => {
	const { annotId } = c.req.param();

	const res = await d365Fetch(
		c.env,
		`/annotations(${annotId})?$select=filename,mimetype,documentbody`
	);

	if (!res.ok) return c.json({ error: "Not found" }, 404);

	const data = await res.json() as { filename: string; mimetype: string; documentbody: string };
	const binary = atob(data.documentbody);
	const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));

	return new Response(bytes, {
		headers: {
			"Content-Type": data.mimetype || "application/octet-stream",
			"Content-Disposition": `attachment; filename="${data.filename}"`,
		},
	});
});

export default cases;
