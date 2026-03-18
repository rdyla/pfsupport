import { useEffect, useState } from "react";
import { accounts, type ContactResult } from "../api";

interface Props {
	accountId: string | null;
	selected: ContactResult[];
	onChange: (contacts: ContactResult[]) => void;
}

export default function ContactPicker({ accountId, selected, onChange }: Props) {
	const [contacts, setContacts] = useState<ContactResult[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!accountId) {
			setContacts([]);
			onChange([]);
			return;
		}
		setLoading(true);
		accounts.getContacts(accountId)
			.then(setContacts)
			.catch(() => setContacts([]))
			.finally(() => setLoading(false));
	}, [accountId]);

	const toggle = (contact: ContactResult) => {
		const exists = selected.some((c) => c.id === contact.id);
		onChange(exists ? selected.filter((c) => c.id !== contact.id) : [...selected, contact]);
	};

	if (!accountId) return null;

	if (loading) {
		return <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading contacts…</div>;
	}

	if (contacts.length === 0) {
		return <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No contacts found for this account.</div>;
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
			{contacts.map((ct) => {
				const checked = selected.some((c) => c.id === ct.id);
				return (
					<label
						key={ct.id}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.6rem",
							fontSize: "14px",
							cursor: "pointer",
							padding: "0.35rem 0.5rem",
							borderRadius: "var(--radius)",
							background: checked ? "var(--bg)" : "transparent",
							border: "1px solid " + (checked ? "var(--border)" : "transparent"),
						}}
					>
						<input
							type="checkbox"
							checked={checked}
							onChange={() => toggle(ct)}
							style={{ cursor: "pointer" }}
						/>
						<span>
							<strong>{ct.name}</strong>
							{ct.email && <span style={{ color: "var(--text-muted)", marginLeft: "0.4rem" }}>{ct.email}</span>}
						</span>
					</label>
				);
			})}
		</div>
	);
}
