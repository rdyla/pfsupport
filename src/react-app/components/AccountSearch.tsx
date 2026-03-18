import { useEffect, useRef, useState } from "react";
import { accounts, type AccountResult } from "../api";

interface Props {
	value: AccountResult | null;
	onChange: (account: AccountResult | null) => void;
}

export default function AccountSearch({ value, onChange }: Props) {
	const [query, setQuery] = useState(value?.name ?? "");
	const [results, setResults] = useState<AccountResult[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	const search = (q: string) => {
		setQuery(q);
		onChange(null);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (q.length < 2) {
			setResults([]);
			setOpen(false);
			return;
		}
		debounceRef.current = setTimeout(async () => {
			setLoading(true);
			try {
				const res = await accounts.search(q);
				setResults(res);
				setOpen(true);
			} catch {
				setResults([]);
			} finally {
				setLoading(false);
			}
		}, 300);
	};

	const select = (account: AccountResult) => {
		setQuery(account.name);
		onChange(account);
		setOpen(false);
		setResults([]);
	};

	const clear = () => {
		setQuery("");
		onChange(null);
		setResults([]);
		setOpen(false);
	};

	return (
		<div ref={containerRef} style={{ position: "relative" }}>
			<div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
				<input
					type="text"
					value={query}
					onChange={(e) => search(e.target.value)}
					placeholder="Search accounts…"
					style={{
						flex: 1,
						padding: "0.6rem 0.75rem",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius)",
						background: "var(--surface)",
						color: "var(--text)",
						outline: "none",
					}}
					autoComplete="off"
				/>
				{(query || value) && (
					<button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
						Clear
					</button>
				)}
			</div>
			{value && (
				<div style={{ marginTop: "0.35rem", fontSize: "13px", color: "var(--text-muted)" }}>
					Selected: <strong style={{ color: "var(--text)" }}>{value.name}</strong>
				</div>
			)}
			{open && (
				<div style={{
					position: "absolute",
					top: "calc(100% + 4px)",
					left: 0,
					right: 0,
					background: "var(--surface)",
					border: "1px solid var(--border)",
					borderRadius: "var(--radius)",
					boxShadow: "var(--shadow-md)",
					zIndex: 200,
					maxHeight: 220,
					overflowY: "auto",
				}}>
					{loading && <div style={{ padding: "0.75rem 1rem", fontSize: "13px", color: "var(--text-muted)" }}>Searching…</div>}
					{!loading && results.length === 0 && (
						<div style={{ padding: "0.75rem 1rem", fontSize: "13px", color: "var(--text-muted)" }}>No accounts found</div>
					)}
					{results.map((a) => (
						<div
							key={a.id}
							onMouseDown={() => select(a)}
							style={{
								padding: "0.6rem 1rem",
								fontSize: "14px",
								cursor: "pointer",
								borderBottom: "1px solid var(--border)",
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = "")}
						>
							{a.name}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
