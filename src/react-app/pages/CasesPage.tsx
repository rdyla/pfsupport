import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatDate, type Case, type PortalUser } from "../api";

interface Props {
	user: PortalUser | null;
}

const STATUS_OPTIONS = ["Active", "All Statuses", "In Progress", "On Hold", "Resolved", "Cancelled"];
const PRIORITY_OPTIONS = ["All Priorities", "High", "Normal", "Low"];
const PAGE_SIZE = 50;

export default function CasesPage({ user }: Props) {
	const [cases, setCases] = useState<Case[]>([]);
	const [loading, setLoading] = useState(true);
	const [searching, setSearching] = useState(false);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("Active");
	const [priorityFilter, setPriorityFilter] = useState("All Priorities");
	const [mineOnly, setMineOnly] = useState(true);
	const [page, setPage] = useState(0);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const navigate = useNavigate();

	const fetchCases = (searchTerm?: string, mine?: boolean) => {
		if (searchTerm) setSearching(true);
		else setLoading(true);
		const useMine = isStaff && (mine ?? mineOnly);
		api.getCases(searchTerm || undefined, useMine)
			.then(setCases)
			.catch((e) => setError(e.message))
			.finally(() => { setLoading(false); setSearching(false); });
	};

	useEffect(() => { fetchCases(); }, [mineOnly]);

	const handleSearch = (value: string) => {
		setSearch(value);
		setPage(0);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => fetchCases(value.trim() || undefined, mineOnly), 400);
	};

	const filtered = cases.filter((c) => {
		const matchStatus = statusFilter === "All Statuses" ||
			(statusFilter === "Active" ? (c.status === "In Progress" || c.status === "On Hold") : c.status === statusFilter);
		const matchPriority = priorityFilter === "All Priorities" || c.priority === priorityFilter;
		return matchStatus && matchPriority;
	});

	const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
	const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
	const resetPage = (fn: () => void) => { fn(); setPage(0); };

	const isStaff = user?.isInternal ?? false;

	return (
		<>
			<div className="page-header">
				<h1>Support Cases</h1>
				<button className="btn btn-primary" onClick={() => navigate("/cases/new")}>
					+ New Case
				</button>
			</div>

			<div className="case-filters">
				{isStaff && (
					<>
						<button
							className={`btn btn-sm ${mineOnly ? "btn-primary" : "btn-secondary"}`}
							onClick={() => { setMineOnly(true); setPage(0); }}
						>
							My Cases
						</button>
						<button
							className={`btn btn-sm ${!mineOnly ? "btn-primary" : "btn-secondary"}`}
							onClick={() => { setMineOnly(false); setPage(0); }}
						>
							All Cases
						</button>
					</>
				)}
				<input
					type="search"
					value={search}
					onChange={(e) => handleSearch(e.target.value)}
					placeholder="Search by title, ticket #, or description…"
					className="filter-search"
				/>
				<select value={statusFilter} onChange={(e) => resetPage(() => setStatusFilter(e.target.value))} className="filter-select">
					{STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
				</select>
				<select value={priorityFilter} onChange={(e) => resetPage(() => setPriorityFilter(e.target.value))} className="filter-select">
					{PRIORITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
				</select>
				{(search || statusFilter !== "Active" || priorityFilter !== "All Priorities") && (
					<button
						className="btn btn-secondary btn-sm"
						onClick={() => {
							if (debounceRef.current) clearTimeout(debounceRef.current);
							setSearch(""); setStatusFilter("Active"); setPriorityFilter("All Priorities"); setPage(0);
							fetchCases(undefined, mineOnly);
						}}
					>
						Clear
					</button>
				)}
			</div>

			<div className="card">
				{(loading || searching) && <div className="loading">{searching ? "Searching…" : "Loading cases…"}</div>}
				{error && <div className="error-msg" style={{ margin: "1rem" }}>{error}</div>}
				{!loading && !searching && !error && filtered.length === 0 && (
					<div className="empty">
						{cases.length === 0 ? "No support cases found." : "No cases match your filters."}
					</div>
				)}
				{!loading && !searching && paginated.length > 0 && (
					<>
						<table className="cases-table">
							<thead>
								<tr>
									<th>Ticket #</th>
									<th>Title</th>
									{isStaff && <th>Account</th>}
									<th>Priority</th>
									<th>Status</th>
									{isStaff && <th>Owner</th>}
									<th>Opened</th>
								</tr>
							</thead>
							<tbody>
								{paginated.map((c) => (
									<tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}>
										<td className="cell-nowrap">
											<span className="ticket-number">{c.ticketNumber}</span>
										</td>
										<td>{c.title}</td>
										{isStaff && (
											<td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
												{c.accountName ?? "—"}
											</td>
										)}
										<td className="cell-nowrap">
											<span className={`badge badge-${c.priority.toLowerCase()}`}>
												{c.priority}
											</span>
										</td>
										<td className="cell-nowrap">
											<span className={`badge badge-${c.state.toLowerCase()}`}>
												{c.status}
											</span>
										</td>
										{isStaff && (
											<td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
												{c.owner ?? "—"}
											</td>
										)}
										<td className="cell-nowrap" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
											{formatDate(c.createdOn)}
										</td>
									</tr>
								))}
							</tbody>
						</table>

						<div className="cases-cards">
							{paginated.map((c) => (
								<div key={c.id} className="cases-card" onClick={() => navigate(`/cases/${c.id}`)}>
									<div className="cases-card-title">{c.title}</div>
									<div className="cases-card-row">
										<span className={`badge badge-${c.state.toLowerCase()}`}>{c.status}</span>
										<span className={`badge badge-${c.priority.toLowerCase()}`}>{c.priority}</span>
										<span className="ticket-number cases-card-meta">{c.ticketNumber}</span>
									</div>
									<div className="cases-card-row">
										{isStaff && c.accountName && (
											<span className="cases-card-meta">{c.accountName}</span>
										)}
										<span className="cases-card-meta">{formatDate(c.createdOn)}</span>
									</div>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			{!loading && !searching && filtered.length > 0 && (
				<div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)" }}>
					<div>
						{totalPages > 1 && (
							<>
								<button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>← Prev</button>
								<span style={{ margin: "0 0.75rem" }}>Page {page + 1} of {totalPages}</span>
								<button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>Next →</button>
							</>
						)}
					</div>
					<div>
						Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}{!search && cases.length >= 500 ? "+" : ""} cases
					</div>
				</div>
			)}
		</>
	);
}
