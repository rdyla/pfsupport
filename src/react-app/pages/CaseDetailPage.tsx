import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { accounts, api, me, fileToBase64, formatDate, type CaseDetail, type ContactResult, type PortalUser, type UserResult } from "../api";
import UserSearch from "../components/UserSearch";

interface Props {
	user: PortalUser | null;
}

export default function CaseDetailPage({ user }: Props) {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [caseData, setCaseData] = useState<CaseDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [noteText, setNoteText] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [noteError, setNoteError] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [statusComment, setStatusComment] = useState("");
	const [statusError, setStatusError] = useState("");
	const [statusSubmitting, setStatusSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Contact editor state
	const [showContactEditor, setShowContactEditor] = useState(false);
	const [accountContacts, setAccountContacts] = useState<ContactResult[]>([]);
	const [pickedPrimaryId, setPickedPrimaryId] = useState<string>("");
	const [pickedContactId, setPickedContactId] = useState<string>("");
	const [pickedEngineer, setPickedEngineer] = useState<UserResult | null>(null);
	const [contactSaving, setContactSaving] = useState(false);

	const load = () => {
		if (!id) return;
		setLoading(true);
		api.getCase(id)
			.then(setCaseData)
			.catch((e) => setError(e.message))
			.finally(() => setLoading(false));
	};

	useEffect(load, [id]);

	const submitNote = async () => {
		if (!id || (!noteText.trim() && !selectedFile)) return;
		setSubmitting(true);
		setNoteError("");
		try {
			if (selectedFile) {
				const documentbody = await fileToBase64(selectedFile);
				await api.addAttachment(id, {
					filename: selectedFile.name,
					mimetype: selectedFile.type || "application/octet-stream",
					documentbody,
					notetext: noteText.trim(),
				});
			} else {
				await api.addNote(id, noteText.trim());
			}
			setNoteText("");
			setSelectedFile(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
			load();
		} catch (e: any) {
			setNoteError(e.message);
		} finally {
			setSubmitting(false);
		}
	};

	const updateStatus = async (action: string) => {
		if (!id) return;
		setStatusSubmitting(true);
		setStatusError("");
		try {
			await api.updateStatus(id, action, statusComment.trim() || undefined);
			setStatusComment("");
			load();
		} catch (e: any) {
			setStatusError(e.message);
		} finally {
			setStatusSubmitting(false);
		}
	};

	const openContactEditor = async (cd: CaseDetail) => {
		setPickedPrimaryId(cd.primaryContactId ?? "");
		setPickedContactId(cd.notificationContactId ?? "");
		setPickedEngineer(
			cd.escalationEngineerId
				? { id: cd.escalationEngineerId, name: cd.escalationEngineerName ?? "", email: "" }
				: null
		);
		// Staff loads contacts via account lookup; customers load their own account's contacts
		if (user?.isInternal) {
			if (cd.accountId) {
				accounts.getContacts(cd.accountId).then(setAccountContacts).catch(() => setAccountContacts([]));
			} else {
				setAccountContacts([]);
			}
		} else {
			me.getContacts().then(setAccountContacts).catch(() => setAccountContacts([]));
		}
		setShowContactEditor(true);
	};

	const saveContacts = async () => {
		if (!id) return;
		setContactSaving(true);
		try {
			await api.updateCaseContacts(id, {
				primaryContactId: pickedPrimaryId || null,
				notificationContactId: pickedContactId || null,
				...(user?.isInternal ? { escalationEngineerId: pickedEngineer?.id ?? null } : {}),
			});
			load();
			setShowContactEditor(false);
		} catch (e: any) {
			// surface error but don't close
			alert(e.message);
		} finally {
			setContactSaving(false);
		}
	};

	if (loading) return <div className="loading">Loading case…</div>;
	if (error) return <div className="error-msg" style={{ margin: "1rem" }}>{error}</div>;
	if (!caseData) return null;

	const isActive = caseData.statecode === 0;
	const isResolved = caseData.statecode === 1;
	const isOnHold = caseData.statuscode === 2;

	return (
		<>
			<a className="back-link" onClick={() => navigate("/cases")} style={{ cursor: "pointer" }}>
				← Back to cases
			</a>

			<div className="case-detail-grid">
				{/* Left: description + notes */}
				<div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
					<div className="card case-meta">
						<div style={{ marginBottom: "0.75rem" }}>
							<h2>{caseData.title}</h2>
						</div>
						{caseData.description && (
							<p className="case-description">{caseData.description}</p>
						)}
					</div>

					<div className="card notes-section" style={{ padding: 0 }}>
						<div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
							<h3 style={{ margin: 0 }}>Activity &amp; Notes</h3>
						</div>

						{caseData.notes.length === 0 && (
							<div className="empty">No notes yet.</div>
						)}

						{caseData.notes.map((note) => (
							<div className="note" key={note.id}>
								<span className="note-meta">
									<strong>{note.createdBy}</strong> · {formatDate(note.createdOn)}
								</span>
								{note.subject && <p className="note-text" style={{ fontWeight: 600 }}>{note.subject}</p>}
								{note.text && <p className="note-text">{note.text}</p>}
								{note.isAttachment && note.filename && (
									<a
										className="note-attachment"
										href={api.getAttachmentUrl(caseData.id, note.id)}
										target="_blank"
										rel="noreferrer"
									>
										📎 {note.filename}
										{note.filesize && (
											<span style={{ color: "var(--text-muted)" }}>
												({(note.filesize / 1024).toFixed(1)} KB)
											</span>
										)}
									</a>
								)}
							</div>
						))}

						{isActive && (
							<div className="add-note">
								<h4>Add a note</h4>
								<textarea
									value={noteText}
									onChange={(e) => setNoteText(e.target.value)}
									placeholder="Write a note or add a file…"
									rows={3}
									style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.6rem 0.75rem", resize: "vertical" }}
								/>
								{noteError && <div className="error-msg">{noteError}</div>}
								<div className="add-note-actions">
									<button
										className="btn btn-primary"
										onClick={submitNote}
										disabled={submitting || (!noteText.trim() && !selectedFile)}
									>
										{submitting ? "Submitting…" : "Submit"}
									</button>
									<label className="file-label">
										📎 Attach file
										<input
											ref={fileInputRef}
											type="file"
											className="file-input"
											onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
										/>
									</label>
									{selectedFile && <span className="file-name">{selectedFile.name}</span>}
								</div>
							</div>
						)}

						{(isActive || isResolved) && (
							<div className="status-update">
								<h4>Update Status</h4>
								<textarea
									value={statusComment}
									onChange={(e) => setStatusComment(e.target.value)}
									placeholder="Optional comment…"
									rows={2}
									style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.5rem 0.75rem", resize: "vertical", fontSize: "13px" }}
								/>
								{statusError && <div className="error-msg">{statusError}</div>}
								<div className="status-actions">
									{isActive && !isOnHold && (
										<button className="btn btn-sm btn-hold" onClick={() => updateStatus("hold")} disabled={statusSubmitting}>
											Put On Hold
										</button>
									)}
									{isActive && isOnHold && (
										<button className="btn btn-sm btn-reopen" onClick={() => updateStatus("in-progress")} disabled={statusSubmitting}>
											Mark In Progress
										</button>
									)}
									{isActive && (
										<button className="btn btn-sm btn-resolve" onClick={() => updateStatus("resolve")} disabled={statusSubmitting}>
											{statusSubmitting ? "Updating…" : "Resolve Case"}
										</button>
									)}
									{isResolved && (
										<button className="btn btn-sm btn-reopen" onClick={() => updateStatus("reopen")} disabled={statusSubmitting}>
											{statusSubmitting ? "Updating…" : "Reopen Case"}
										</button>
									)}
									{user?.isInternal && isActive && (
										<button className="btn btn-sm btn-cancel" onClick={() => updateStatus("cancel")} disabled={statusSubmitting}>
											Cancel Case
										</button>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Right: metadata */}
				<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
					<div className="card meta-list">
						{caseData.accountName && (
							<div className="meta-item" style={{ paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)", marginBottom: "0.25rem" }}>
								<span style={{ fontWeight: 700, fontSize: "15px", color: "var(--navy)" }}>{caseData.accountName}</span>
							</div>
						)}
						<div className="meta-item">
							<span className="meta-label">Status</span>
							<span className={`badge badge-${caseData.state.toLowerCase()}`}>{caseData.status}</span>
						</div>
						<div className="meta-item">
							<span className="meta-label">Priority</span>
							<span className={`badge badge-${caseData.priority.toLowerCase()}`}>{caseData.priority}</span>
						</div>
						<div className="meta-item">
							<span className="meta-label">Assigned To</span>
							<span className="meta-value">{caseData.owner ?? "Unassigned"}</span>
						</div>
						<div className="meta-item">
							<span className="meta-label">Opened</span>
							<span className="meta-value">{formatDate(caseData.createdOn)}</span>
						</div>
						<div className="meta-item">
							<span className="meta-label">Ticket #</span>
							<span className="meta-value" style={{ fontFamily: "monospace" }}>{caseData.ticketNumber}</span>
						</div>
					</div>

					{/* Contacts panel */}
					<div className="card meta-list">
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
							<span className="meta-label" style={{ fontSize: "11px" }}>Contacts</span>
							<button type="button" className="btn btn-secondary btn-sm" onClick={() => openContactEditor(caseData)}>
								Edit
							</button>
						</div>
						<div className="meta-item">
							<span className="meta-label">Primary Contact</span>
							<span className="meta-value">{caseData.primaryContactName ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>None</span>}</span>
						</div>
						<div className="meta-item">
							<span className="meta-label">Notification Contact</span>
							<span className="meta-value">{caseData.notificationContactName ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>None</span>}</span>
						</div>
						{user?.isInternal && (
							<div className="meta-item">
								<span className="meta-label">Escalation Engineer</span>
								<span className="meta-value">{caseData.escalationEngineerName ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>None</span>}</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Contact editor modal */}
			{showContactEditor && (
				<div style={{
					position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
					display: "flex", alignItems: "center", justifyContent: "center",
					zIndex: 500, padding: "1rem",
				}}>
					<div className="card" style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column" }}>
						<div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
							<h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--navy)" }}>Edit Contacts</h3>
							<button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowContactEditor(false)}>✕</button>
						</div>
						<div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
							<div className="form-group" style={{ margin: 0 }}>
								<label style={{ fontSize: "13px", fontWeight: 600 }}>Primary Contact</label>
								<select
									value={pickedPrimaryId}
									onChange={(e) => setPickedPrimaryId(e.target.value)}
									style={{ padding: "0.6rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", outline: "none" }}
								>
									<option value="">— None —</option>
									{accountContacts.map((ct) => (
										<option key={ct.id} value={ct.id}>{ct.name}{ct.email ? ` (${ct.email})` : ""}</option>
									))}
								</select>
							</div>
							<div className="form-group" style={{ margin: 0 }}>
								<label style={{ fontSize: "13px", fontWeight: 600 }}>Notification Contact</label>
								<select
									value={pickedContactId}
									onChange={(e) => setPickedContactId(e.target.value)}
									style={{ padding: "0.6rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", outline: "none" }}
								>
									<option value="">— None —</option>
									{accountContacts.map((ct) => (
										<option key={ct.id} value={ct.id}>{ct.name}{ct.email ? ` (${ct.email})` : ""}</option>
									))}
								</select>
								{accountContacts.length === 0 && (
									<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No contacts available for this account.</span>
								)}
							</div>
							{user?.isInternal && (
								<div className="form-group" style={{ margin: 0 }}>
									<label style={{ fontSize: "13px", fontWeight: 600 }}>Escalation Engineer</label>
									<UserSearch value={pickedEngineer} onChange={setPickedEngineer} placeholder="Search PF staff…" />
								</div>
							)}
						</div>
						<div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
							<button type="button" className="btn btn-secondary" onClick={() => setShowContactEditor(false)}>Cancel</button>
							<button type="button" className="btn btn-primary" onClick={saveContacts} disabled={contactSaving}>
								{contactSaving ? "Saving…" : "Save"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
