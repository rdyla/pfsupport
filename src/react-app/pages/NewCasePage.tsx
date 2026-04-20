import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { accounts, api, CUSTOMER_SEVERITY_OPTIONS, SEVERITY, STAFF_SEVERITY_OPTIONS, type AccountResult, type ContactResult, type PortalUser, type UserResult } from "../api";
import AccountSearch from "../components/AccountSearch";
import UserSearch from "../components/UserSearch";

interface Props {
	user: PortalUser | null;
}

export default function NewCasePage({ user }: Props) {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [severitycode, setSeveritycode] = useState<number>(SEVERITY.P3);
	const severityOptions = user?.isInternal ? STAFF_SEVERITY_OPTIONS : CUSTOMER_SEVERITY_OPTIONS;
	const [account, setAccount] = useState<AccountResult | null>(null);
	const [accountContacts, setAccountContacts] = useState<ContactResult[]>([]);
	const [primaryContactId, setPrimaryContactId] = useState("");
	const [notificationContactId, setNotificationContactId] = useState("");
	const [escalationEngineer, setEscalationEngineer] = useState<UserResult | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	// Load contacts when account changes
	useEffect(() => {
		setPrimaryContactId("");
		setNotificationContactId("");
		setAccountContacts([]);
		if (account?.id) {
			accounts.getContacts(account.id).then(setAccountContacts).catch(() => {});
		}
	}, [account?.id]);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");
		try {
			const result = await api.createCase({
				title,
				description,
				severitycode,
				...(user?.isInternal && account ? { accountId: account.id } : {}),
				...(primaryContactId ? { primaryContactId } : {}),
				...(notificationContactId ? { notificationContactId } : {}),
				...(escalationEngineer ? { escalationEngineerId: escalationEngineer.id } : {}),
			});
			const severityLabel = severityOptions.find((o) => o.value === severitycode)?.label ?? "P3";
			navigate("/cases/confirmation", {
				state: { id: result.id, ticketNumber: result.ticketNumber, title, severityLabel },
			});
		} catch (e: any) {
			setError(e.message);
			setSubmitting(false);
		}
	};

	return (
		<>
			<a className="back-link" onClick={() => navigate("/cases")} style={{ cursor: "pointer" }}>
				← Back to cases
			</a>
			<div className="card form-card" style={{ maxWidth: 680 }}>
				<h2>Open a New Support Case</h2>
				<form onSubmit={submit}>
					{user?.isInternal && (
						<div className="form-group">
							<label>Account</label>
							<AccountSearch value={account} onChange={(a) => setAccount(a)} />
						</div>
					)}

					<div className="form-group">
						<label htmlFor="title">Subject *</label>
						<input
							id="title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Brief summary of the issue"
							required
						/>
					</div>
					<div className="form-group">
						<label htmlFor="severity">Severity</label>
						<select
							id="severity"
							value={severitycode}
							onChange={(e) => setSeveritycode(Number(e.target.value))}
						>
							{severityOptions.map((o) => (
								<option key={o.value} value={o.value}>{o.label}</option>
							))}
						</select>
					</div>
					<div className="form-group">
						<label htmlFor="description">Description *</label>
						<textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Describe the issue in detail — include any error messages, steps to reproduce, and how it's impacting your business."
							rows={7}
							required
						/>
					</div>

					{/* Contact fields — staff only, shown once account is selected */}
					{user?.isInternal && account && (
						<>
							<div className="form-group">
								<label>Primary Contact</label>
								<select
									value={primaryContactId}
									onChange={(e) => setPrimaryContactId(e.target.value)}
									style={{ padding: "0.6rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", outline: "none" }}
								>
									<option value="">— None —</option>
									{accountContacts.map((ct) => (
										<option key={ct.id} value={ct.id}>{ct.name}{ct.email ? ` (${ct.email})` : ""}</option>
									))}
								</select>
							</div>
							<div className="form-group">
								<label>Notification Contact</label>
								<select
									value={notificationContactId}
									onChange={(e) => setNotificationContactId(e.target.value)}
									style={{ padding: "0.6rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", outline: "none" }}
								>
									<option value="">— None —</option>
									{accountContacts.map((ct) => (
										<option key={ct.id} value={ct.id}>{ct.name}{ct.email ? ` (${ct.email})` : ""}</option>
									))}
								</select>
							</div>
							<div className="form-group">
								<label>Escalation Engineer</label>
								<UserSearch value={escalationEngineer} onChange={setEscalationEngineer} placeholder="Search PF staff…" />
							</div>
						</>
					)}

					{error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}
					<div className="form-actions">
						<button type="submit" className="btn btn-primary" disabled={submitting}>
							{submitting ? "Submitting…" : "Submit Case"}
						</button>
						<button type="button" className="btn btn-secondary" onClick={() => navigate("/cases")}>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</>
	);
}
