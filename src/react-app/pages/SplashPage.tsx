import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const COOKIE_NAME = "migration_notice_dismissed";

function isDismissed(): boolean {
	return document.cookie.split(";").some(c => c.trim().startsWith(`${COOKIE_NAME}=true`));
}

function setDismissed() {
	document.cookie = `${COOKIE_NAME}=true; max-age=7776000; path=/; SameSite=Lax`;
}

export default function SplashPage() {
	const navigate = useNavigate();

	useEffect(() => {
		if (isDismissed()) {
			navigate("/cases", { replace: true });
		}
	}, [navigate]);

	function dismiss() {
		setDismissed();
		navigate("/cases", { replace: true });
	}

	return (
		<div className="splash-panel">
			<div className="splash-top">
				<div className="splash-badge">Portal Update</div>
				<h1 className="splash-title">
					Welcome to Your<br /><span>New Support Portal</span>
				</h1>
				<p className="splash-sub">
					We've moved to a new home — your cases, history, and login are all right here waiting for you.
				</p>
			</div>

			<div className="splash-body">
				<p className="splash-intro">
					As part of our continued investment in your support experience, the Packet Fusion customer
					portal has migrated from our previous platform to{" "}
					<strong>support.packetfusion.com</strong> — our own domain.
					Nothing about your account or cases has changed.
				</p>

				<div className="url-card" role="region" aria-label="Portal address change">
					<div className="url-card-label">Portal Address Change</div>
					<div className="url-row">
						<div className="url-col">
							<div className="url-col-lbl">Previous Address</div>
							<div className="url-old-val">packetfusion.peakportals.com</div>
						</div>
						<div className="url-arrow" aria-hidden="true">→</div>
						<div className="url-col">
							<div className="url-col-lbl">New Address</div>
							<div className="url-new-val">support.packetfusion.com</div>
						</div>
					</div>
				</div>

				<ul className="splash-checklist" aria-label="What stays the same">
					<li>
						<div className="check-dot" aria-hidden="true">✓</div>
						<span>To <strong>log in</strong>, enter your work email address — you'll receive a one-time code from <strong>Cloudflare</strong> (our access provider). Check your inbox for an email from Cloudflare and use the code to sign in.</span>
					</li>
					<li>
						<div className="check-dot" aria-hidden="true">✓</div>
						<span>All <strong>open and historical cases</strong> are intact — nothing has been lost or reset</span>
					</li>
					<li>
						<div className="check-dot" aria-hidden="true">✓</div>
						<span>Enjoy an <strong>updated, more intuitive interface</strong> — redesigned to make managing your cases easier</span>
					</li>
					<li>
						<div className="check-dot" aria-hidden="true">✓</div>
						<span>Update your <strong>bookmark</strong> to support.packetfusion.com for direct access going forward</span>
					</li>
				</ul>

				<div className="splash-cta-row">
					<button className="btn btn-primary" onClick={dismiss}>
						Continue to My Cases
					</button>
					<button className="btn btn-secondary" onClick={dismiss}>
						Dismiss
					</button>
					<span className="splash-cta-note">
						Questions?{" "}
						<a href="mailto:support@packetfusion.com">support@packetfusion.com</a>
						{" | "}
						<a href="tel:9257012020">925-701-2020</a>
					</span>
				</div>
			</div>
		</div>
	);
}
