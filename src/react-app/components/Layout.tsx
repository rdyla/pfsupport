import { NavLink } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "../assets/packetfusionlogo_white.png";
import type { PortalUser } from "../api";

interface Props {
	user: PortalUser | null;
	children: React.ReactNode;
}

function getInitials(name: string) {
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) return parts[0][0].toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ProfileChip({ user }: { user: PortalUser }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	return (
		<div className="profile-chip-wrap" ref={ref}>
			<button
				className="profile-chip"
				onClick={() => setOpen(o => !o)}
				aria-expanded={open}
				aria-haspopup="true"
			>
				<span className="profile-avatar">{getInitials(user.name)}</span>
				<span className="profile-chip-text">
					<span className="profile-name">{user.name}</span>
					{user.accountName && <span className="profile-company">{user.accountName}</span>}
				</span>
				{user.isInternal && <span className="badge badge-active">Staff</span>}
				<svg className="profile-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
					<path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			</button>

			{open && (
				<div className="profile-popout">
					<div className="profile-popout-header">
						<div className="profile-popout-avatar">{getInitials(user.name)}</div>
						<div className="profile-popout-info">
							<div className="profile-popout-name">{user.name}</div>
							{user.accountName && <div className="profile-popout-company">{user.accountName}</div>}
							<div className="profile-popout-email">{user.email}</div>
						</div>
					</div>
					<div className="profile-popout-divider" />
					<a
						href="/cdn-cgi/access/logout"
						className="profile-popout-signout"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
						Sign out
					</a>
				</div>
			)}
		</div>
	);
}

export default function Layout({ user, children }: Props) {
	return (
		<div className="layout">
			<header className="header">
				<img src={logo} alt="Packet Fusion" className="header-logo" />
				{user && <ProfileChip user={user} />}
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
