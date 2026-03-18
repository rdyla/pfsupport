import { NavLink } from "react-router-dom";
import logo from "../assets/packetfusionlogo_white.png";
import type { PortalUser } from "../api";

interface Props {
	user: PortalUser | null;
	children: React.ReactNode;
}

export default function Layout({ user, children }: Props) {
	return (
		<div className="layout">
			<header className="header">
				<img src={logo} alt="Packet Fusion" className="header-logo" />
				{user && (
					<div className="header-user">
						<span className="header-welcome">Welcome, <strong>{user.name}</strong></span>
						{user.isInternal && (
							<span className="badge badge-active">Staff</span>
						)}
						<a
							href="/cdn-cgi/access/logout"
							style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", marginLeft: "0.5rem" }}
						>
							Sign out
						</a>
					</div>
				)}
			</header>
			<nav className="nav-tabs">
				<NavLink to="/cases" className={({ isActive }) => `nav-tab${isActive ? " active" : ""}`}>
					Support Cases
				</NavLink>
				<NavLink to="/kb" className={({ isActive }) => `nav-tab${isActive ? " active" : ""}`}>
					Knowledge Base
				</NavLink>
			</nav>
			<main className="main">{children}</main>
		</div>
	);
}
