import { Hono } from "hono";
import type { PortalUser } from "../auth";

type Variables = { user: PortalUser };

const kb = new Hono<{ Bindings: Env; Variables: Variables }>();

const INDEX_KEY = "kb:index";

interface ArticleMeta {
	id: string;
	title: string;
	description: string;
	category: string;
	createdAt: string;
	createdBy: string;
}

interface Article extends ArticleMeta {
	content: string;
}

async function getIndex(env: Env): Promise<ArticleMeta[]> {
	const raw = await env.KV.get(INDEX_KEY, "json") as ArticleMeta[] | null;
	return raw ?? [];
}

async function saveIndex(env: Env, index: ArticleMeta[]) {
	await env.KV.put(INDEX_KEY, JSON.stringify(index));
}


// GET /api/portal/kb
kb.get("/", async (c) => {
	const index = await getIndex(c.env);
	return c.json(index);
});

// GET /api/portal/kb/:id
kb.get("/:id", async (c) => {
	const { id } = c.req.param();
	const article = await c.env.KV.get(`kb:article:${id}`, "json") as Article | null;
	if (!article) return c.json({ error: "Not found" }, 404);
	return c.json(article);
});

// POST /api/portal/kb/upload — internal only
kb.post("/upload", async (c) => {
	const user = c.get("user");
	if (!user.isInternal) return c.json({ error: "Forbidden" }, 403);

	const body = await c.req.json() as {
		title: string;
		description: string;
		category: string;
		markdown: string;
	};

	if (!body.title || !body.markdown) {
		return c.json({ error: "title and markdown are required" }, 400);
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	const article: Article = {
		id,
		title: body.title,
		description: body.description,
		category: body.category || "General",
		content: body.markdown,
		createdAt: now,
		createdBy: user.name,
	};

	await c.env.KV.put(`kb:article:${id}`, JSON.stringify(article));

	const index = await getIndex(c.env);
	index.unshift({ id, title: body.title, description: body.description, category: body.category || "General", createdAt: now, createdBy: user.name });
	await saveIndex(c.env, index);

	return c.json({ id, title: body.title }, 201);
});

// DELETE /api/portal/kb/:id — internal only
kb.delete("/:id", async (c) => {
	const user = c.get("user");
	if (!user.isInternal) return c.json({ error: "Forbidden" }, 403);

	const { id } = c.req.param();
	await c.env.KV.delete(`kb:article:${id}`);

	const index = await getIndex(c.env);
	await saveIndex(c.env, index.filter((a) => a.id !== id));

	return c.json({ ok: true });
});

export default kb;
