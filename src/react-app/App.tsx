import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { api, type PortalUser } from "./api";
import Layout from "./components/Layout";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import NewCasePage from "./pages/NewCasePage";
import KBPage from "./pages/KBPage";
import KBArticlePage from "./pages/KBArticlePage";

export default function App() {
	const [user, setUser] = useState<PortalUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		api.getMe()
			.then(setUser)
			.catch(() => setUser(null))
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)" }}>
				Loading…
			</div>
		);
	}

	return (
		<BrowserRouter>
			<Layout user={user}>
				<Routes>
					<Route path="/" element={<Navigate to="/cases" replace />} />
					<Route path="/cases" element={<CasesPage user={user} />} />
					<Route path="/cases/new" element={<NewCasePage user={user} />} />
					<Route path="/cases/:id" element={<CaseDetailPage user={user} />} />
					<Route path="/kb" element={<KBPage user={user} />} />
					<Route path="/kb/:id" element={<KBArticlePage user={user} />} />
				</Routes>
			</Layout>
		</BrowserRouter>
	);
}
