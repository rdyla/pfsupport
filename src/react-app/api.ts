// severitycode option-set values in D365
export const SEVERITY = {
	P1: 1,
	P2: 173590000,
	P3: 173590001,
	E1: 100000000,
	E2: 100000001,
} as const;

export const CUSTOMER_SEVERITY_OPTIONS: Array<{ value: number; label: string }> = [
	{ value: SEVERITY.P1, label: "P1" },
	{ value: SEVERITY.P2, label: "P2" },
	{ value: SEVERITY.P3, label: "P3" },
];

export const STAFF_SEVERITY_OPTIONS: Array<{ value: number; label: string }> = [
	...CUSTOMER_SEVERITY_OPTIONS,
	{ value: SEVERITY.E1, label: "E1" },
	{ value: SEVERITY.E2, label: "E2" },
];

export function severityBadgeClass(label: string | null | undefined): string {
	switch (label) {
		case "P1": return "badge-p1";
		case "P2": return "badge-p2";
		case "P3": return "badge-p3";
		case "E1": return "badge-e1";
		case "E2": return "badge-e2";
		default: return "badge-normal";
	}
}

export interface PortalUser {
	email: string;
	contactId: string;
	name: string;
	isInternal: boolean;
	accountName: string | null;
}

export interface Case {
	id: string;
	ticketNumber: string;
	title: string;
	severity: string | null;
	status: string;
	state: string;
	createdOn: string;
	owner: string | null;
	accountName: string | null;
}

export interface Note {
	id: string;
	subject: string | null;
	text: string | null;
	isAttachment: boolean;
	filename: string | null;
	mimetype: string | null;
	filesize: number | null;
	createdOn: string;
	createdBy: string;
}

export interface CaseDetail extends Case {
	description: string;
	modifiedOn: string;
	statecode: number;
	statuscode: number;
	severitycode: number | null;
	accountId: string | null;
	ownerId: string | null;
	primaryContactId: string | null;
	primaryContactName: string | null;
	notificationContactId: string | null;
	notificationContactName: string | null;
	escalationEngineerId: string | null;
	escalationEngineerName: string | null;
	notes: Note[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, init);
	if (res.status === 401) {
		window.location.href = "/login";
		throw new Error("Unauthorized");
	}
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
		throw new Error(err.error || res.statusText);
	}
	return res.json() as Promise<T>;
}

export const api = {
	getMe: () => request<PortalUser>("/api/portal/me"),
	getCases: (search?: string, mine?: boolean) => {
		const params = new URLSearchParams();
		if (search) params.set("search", search);
		if (mine) params.set("mine", "true");
		const qs = params.toString();
		return request<Case[]>(`/api/portal/cases${qs ? `?${qs}` : ""}`);
	},
	getCase: (id: string) => request<CaseDetail>(`/api/portal/cases/${id}`),
	createCase: (data: { title: string; description: string; severitycode: number; accountId?: string; primaryContactId?: string; notificationContactId?: string; escalationEngineerId?: string }) =>
		request<{ id: string; ticketNumber: string }>("/api/portal/cases", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}),
	addNote: (caseId: string, text: string) =>
		request("/api/portal/cases/" + caseId + "/notes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
		}),
	addAttachment: (caseId: string, data: { filename: string; mimetype: string; documentbody: string; notetext?: string }) =>
		request("/api/portal/cases/" + caseId + "/attachments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}),
	updateStatus: (caseId: string, action: string, comment?: string) =>
		request("/api/portal/cases/" + caseId + "/status", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action, comment }),
		}),
	updateCaseContacts: (caseId: string, data: { primaryContactId?: string | null; notificationContactId?: string | null; escalationEngineerId?: string | null; ownerId?: string | null }) =>
		request("/api/portal/cases/" + caseId + "/contacts", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}),
	getAttachmentUrl: (caseId: string, annotId: string) =>
		`/api/portal/cases/${caseId}/attachments/${annotId}/download`,
};

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", {
		year: "numeric", month: "short", day: "numeric",
		hour: "2-digit", minute: "2-digit",
	});
}

export interface AccountResult {
	id: string;
	name: string;
}

export interface ContactResult {
	id: string;
	name: string;
	email: string;
}

export interface UserResult {
	id: string;
	name: string;
	email: string;
}

export const me = {
	getContacts: () => request<ContactResult[]>("/api/portal/me/contacts"),
};

export const accounts = {
	search: (q: string) => request<AccountResult[]>(`/api/portal/accounts?search=${encodeURIComponent(q)}`),
	getContacts: (accountId: string) => request<ContactResult[]>(`/api/portal/accounts/${accountId}/contacts`),
};

export const users = {
	search: (q: string) => request<UserResult[]>(`/api/portal/users?search=${encodeURIComponent(q)}`),
};

export const caseContacts = {
	list: (caseId: string) => request<ContactResult[]>(`/api/portal/cases/${caseId}/contacts`),
	add: (caseId: string, contactId: string) =>
		request(`/api/portal/cases/${caseId}/contacts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ contactId }),
		}),
	remove: (caseId: string, contactId: string) =>
		request(`/api/portal/cases/${caseId}/contacts/${contactId}`, { method: "DELETE" }),
};

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// Strip the data URL prefix (data:mime/type;base64,)
			resolve(result.split(",")[1]);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
