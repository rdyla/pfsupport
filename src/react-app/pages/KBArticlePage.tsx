import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { kb, formatDate, type KBArticle, type PortalUser } from "../api";

interface Props {
	user: PortalUser | null;
}

export default function KBArticlePage({ user }: Props) {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [article, setArticle] = useState<KBArticle | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!id) return;
		kb.get(id)
			.then(setArticle)
			.catch((e) => setError(e.message))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!id || !confirm("Delete this article? This cannot be undone.")) return;
		setDeleting(true);
		try {
			await kb.delete(id);
			navigate("/kb");
		} catch (e: any) {
			setError(e.message);
			setDeleting(false);
		}
	};

	if (loading) return <div className="loading">Loading…</div>;
	if (error) return <div className="error-msg" style={{ margin: "1rem" }}>{error}</div>;
	if (!article) return null;

	return (
		<>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
				<a className="back-link" onClick={() => navigate("/kb")} style={{ cursor: "pointer" }}>
					← Back to Knowledge Base
				</a>
				{user?.isInternal && (
					<button className="btn btn-sm btn-cancel" onClick={handleDelete} disabled={deleting}>
						{deleting ? "Deleting…" : "Delete Article"}
					</button>
				)}
			</div>

			<div className="card" style={{ padding: "2rem" }}>
				<div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
					<div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
						<span className="badge badge-active">{article.category}</span>
						<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
							Added by {article.createdBy} · {formatDate(article.createdAt)}
						</span>
					</div>
					{article.description && (
						<p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "0.25rem" }}>{article.description}</p>
					)}
				</div>

				<div className="kb-content">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>
						{article.content}
					</ReactMarkdown>
				</div>
			</div>
		</>
	);
}
