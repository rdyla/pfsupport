import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { kb, formatDate, type KBArticleMeta, type PortalUser } from "../api";
import { convertDocxToMarkdown, convertTextToMarkdown } from "../lib/docx";

interface Props {
	user: PortalUser | null;
}

export default function KBPage({ user }: Props) {
	const navigate = useNavigate();
	const [articles, setArticles] = useState<KBArticleMeta[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [showUpload, setShowUpload] = useState(false);

	const load = () => {
		kb.list()
			.then(setArticles)
			.catch((e) => setError(e.message))
			.finally(() => setLoading(false));
	};

	useEffect(load, []);

	const filtered = articles.filter(
		(a) =>
			a.title.toLowerCase().includes(search.toLowerCase()) ||
			a.description.toLowerCase().includes(search.toLowerCase()) ||
			a.category.toLowerCase().includes(search.toLowerCase())
	);

	const categories = [...new Set(filtered.map((a) => a.category))].sort();

	return (
		<>
			<div className="page-header">
				<h1>Knowledge Base</h1>
				{user?.isInternal && (
					<button className="btn btn-primary" onClick={() => setShowUpload(true)}>
						+ Upload Article
					</button>
				)}
			</div>

			<div style={{ marginBottom: "1.25rem" }}>
				<input
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search articles…"
					style={{
						width: "100%", maxWidth: 420, padding: "0.55rem 0.9rem",
						border: "1px solid var(--border)", borderRadius: "var(--radius)",
						background: "var(--surface)", fontSize: "14px", outline: "none",
					}}
				/>
			</div>

			{loading && <div className="loading">Loading…</div>}
			{error && <div className="error-msg">{error}</div>}

			{!loading && filtered.length === 0 && (
				<div className="empty card" style={{ padding: "3rem" }}>
					{search ? "No articles match your search." : "No knowledge base articles yet."}
				</div>
			)}

			{categories.map((cat) => (
				<div key={cat} style={{ marginBottom: "2rem" }}>
					<h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
						{cat}
					</h2>
					<div className="card" style={{ padding: 0 }}>
						{filtered.filter((a) => a.category === cat).map((article, i, arr) => (
							<div
								key={article.id}
								onClick={() => navigate(`/kb/${article.id}`)}
								style={{
									padding: "1rem 1.25rem",
									borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
									cursor: "pointer",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "flex-start",
									gap: "1rem",
									transition: "background 0.1s",
								}}
								onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
								onMouseLeave={(e) => (e.currentTarget.style.background = "")}
							>
								<div>
									<div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: "0.2rem" }}>{article.title}</div>
									{article.description && (
										<div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{article.description}</div>
									)}
								</div>
								<div style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
									{formatDate(article.createdAt)}
								</div>
							</div>
						))}
					</div>
				</div>
			))}

			{showUpload && (
				<UploadModal
					onClose={() => setShowUpload(false)}
					onSuccess={() => { setShowUpload(false); load(); }}
				/>
			)}
		</>
	);
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!file) { setError("Please select a file"); return; }

		const name = file.name.toLowerCase();
		const isPdf = name.endsWith(".pdf");
		const isDocx = name.endsWith(".docx");
		const isTxt = name.endsWith(".txt") || name.endsWith(".md");

		if (isPdf) {
			setError("PDF conversion requires the Anthropic API (coming soon). Please upload a .docx or .txt file for now.");
			return;
		}

		setUploading(true);
		setError("");
		try {
			let markdown: string;
			if (isDocx) {
				const buffer = await file.arrayBuffer();
				markdown = convertDocxToMarkdown(new Uint8Array(buffer), title);
			} else if (isTxt) {
				const text = await file.text();
				markdown = convertTextToMarkdown(text, title);
			} else {
				throw new Error("Unsupported file type. Please upload a .docx or .txt file.");
			}

			await kb.upload({ title, description, category: category || "General", markdown });
			onSuccess();
		} catch (e: any) {
			setError(e.message);
		} finally {
			setUploading(false);
		}
	};

	return (
		<div style={{
			position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
			display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
		}}>
			<div className="card form-card" style={{ width: "100%", maxWidth: 520, margin: "1rem" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
					<h2 style={{ margin: 0 }}>Upload KB Article</h2>
					<button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.25rem", color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
				</div>
				<form onSubmit={submit}>
					<div className="form-group">
						<label>Title *</label>
						<input value={title} onChange={(e) => setTitle(e.target.value)} required />
					</div>
					<div className="form-group">
						<label>Description</label>
						<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary shown in the article list" />
					</div>
					<div className="form-group">
						<label>Category</label>
						<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Networking, Security, Getting Started" />
					</div>
					<div className="form-group">
						<label>File * (Word .docx or .txt — PDF requires API)</label>
						<label className="file-label" style={{ display: "inline-flex" }}>
							📄 {file ? file.name : "Choose file…"}
							<input
								ref={fileRef}
								type="file"
								className="file-input"
								accept=".docx,.txt,.md"
								onChange={(e) => setFile(e.target.files?.[0] ?? null)}
							/>
						</label>
					</div>
					{error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}
					{uploading && (
						<div style={{ marginBottom: "1rem", fontSize: "13px", color: "var(--text-muted)" }}>
							Converting document… this may take a moment.
						</div>
					)}
					<div className="form-actions">
						<button type="submit" className="btn btn-primary" disabled={uploading || !file || !title}>
							{uploading ? "Converting…" : "Upload & Convert"}
						</button>
						<button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	);
}
