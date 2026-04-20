import { useLocation, useNavigate } from "react-router-dom";
import { severityBadgeClass } from "../api";

interface ConfirmationState {
	id: string;
	ticketNumber: string;
	title: string;
	severityLabel: string;
}

export default function CaseConfirmationPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const state = location.state as ConfirmationState | null;

	// If someone lands here directly with no state, send them to cases
	if (!state) {
		navigate("/cases", { replace: true });
		return null;
	}

	const { id, ticketNumber, title, severityLabel } = state;

	return (
		<div className="card form-card" style={{ maxWidth: 600, textAlign: "center", padding: "2.5rem 2rem" }}>
			<div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✅</div>
			<h2 style={{ marginBottom: "0.25rem" }}>Case Submitted</h2>
			<p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
				Your support case has been created and our team has been notified.
			</p>

			<div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem", textAlign: "left", marginBottom: "2rem" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
					<span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Case Number</span>
					<strong style={{ fontSize: "1rem" }}>{ticketNumber}</strong>
				</div>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
					<span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</span>
					<span style={{ maxWidth: "70%", textAlign: "right" }}>{title}</span>
				</div>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Severity</span>
					<span className={`badge ${severityBadgeClass(severityLabel)}`}>{severityLabel}</span>
				</div>
			</div>

			<div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
				<button className="btn btn-primary" onClick={() => navigate(`/cases/${id}`)}>
					View Case
				</button>
				<button className="btn btn-secondary" onClick={() => navigate("/cases")}>
					Back to My Cases
				</button>
			</div>
		</div>
	);
}
