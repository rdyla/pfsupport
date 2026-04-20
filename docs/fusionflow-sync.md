# Porting notes — pfsupport → fusionflow supportportal

Changes made to `pfsupport` on 2026-04-20 that need to be mirrored to the
fusionflow supportportal. Commits on `main` since `fc0c964`:

- `0a7c93a` — Restrict case status changes to internal users; allow customer reopen within 30 days
- `b356977` — Drop `actualend` field (not queryable); use `modifiedon` instead
- `fe2e778` — Replace portal priority with CRM `severitycode`; sync status labels from D365
- `1d58c12` — Remove Put On Hold button

---

## 1. Customer status controls removed; 30-day reopen window added

**Problem:** Customers could Resolve or Put On Hold from the portal. When a
customer resolved a case, engineers could no longer add notes or time
entries. Also — customers should still be able to reopen a recently closed
case without filing a new one.

**Change:**
- Hide Update Status panel from non-internal users on `CaseDetailPage`.
- Show a dedicated Reopen panel to customers when the case is Resolved (statecode=1) or Cancelled (statecode=2) **and** the case was closed within 30 days.
- Backend rejects any status action from non-internal users except `reopen`, and re-verifies the 30-day window server-side before allowing the reopen.

**Files touched:**
- `src/react-app/pages/CaseDetailPage.tsx` — guard status panel on `user?.isInternal`; compute `canCustomerReopen`; new Reopen Case block.
- `src/worker/routes/cases.ts` — `POST /:id/status` enforces customer restrictions; fetches `statecode` + `modifiedon` before allowing reopen.
- `src/react-app/api.ts` — add `modifiedOn: string` to `CaseDetail`.
- `src/worker/routes/cases.ts` GET `/:id` — select `modifiedon` and return it as `modifiedOn`.

**Gotcha:** Originally used D365's `actualend` for the close timestamp. In
Packet Fusion's D365 tenant, `actualend` is **not queryable** on the
incident entity — it returns `Could not find a property named 'actualend'`.
Use `modifiedon` as a proxy instead (accurate because closed cases aren't
being edited).

## 2. Priority → Severity (synced with CRM)

**Problem:** The portal's Priority field was a local-only High/Normal/Low
stored in `prioritycode` but treated as a cosmetic label — it didn't reflect
the real customer-facing triage value. CRM has a separate `severitycode`
field with P1/P2/P3 (customer-assignable) plus E1/E2 (internal escalation
tiers).

**Change:**
- Replace `prioritycode` with `severitycode` throughout the portal.
- Customers see P1/P2/P3 in the new-case dropdown; staff additionally see E1/E2.
- Backend validates customer submissions against allowlist.
- Status labels now come from D365's `@OData.Community.Display.V1.FormattedValue` annotation (no more stale hardcoded `STATUS_MAP`). This makes the real CRM statuses (New, Waiting on Customer, Project Scheduled, Closed Break Fix, etc.) show up correctly.

**Files touched:**
- `src/worker/routes/cases.ts` —
  - remove `PRIORITY_MAP` and `STATUS_MAP`
  - add `CUSTOMER_SEVERITY_VALUES` (allowlist) and `DEFAULT_SEVERITY`
  - swap `prioritycode` → `severitycode` in list/detail `$select` and payload mapping
  - read severity + status labels from FormattedValue annotations (the existing `Prefer: odata.include-annotations` header already handles this)
  - POST `/`: accept `severitycode`, validate if `!user.isInternal`
- `src/react-app/api.ts` —
  - `Case.priority: string` → `Case.severity: string | null`
  - `CaseDetail`: add `severitycode: number | null`
  - `createCase` params: `severitycode: number` instead of `prioritycode`
  - export `SEVERITY` enum, `CUSTOMER_SEVERITY_OPTIONS`, `STAFF_SEVERITY_OPTIONS`, `severityBadgeClass()` helper
- `src/react-app/pages/NewCasePage.tsx` — severity state + dropdown gated on role
- `src/react-app/pages/CaseConfirmationPage.tsx` — swap `prioritycode` → `severityLabel` in navigation state
- `src/react-app/pages/CasesPage.tsx` — rename filter to Severity with P1/P2/P3/E1/E2 options; status filter simplified to state-level (Active/Resolved/Cancelled); badges use `severityBadgeClass`
- `src/react-app/pages/CaseDetailPage.tsx` — show "Severity" instead of "Priority"
- `src/react-app/App.css` — add `.badge-p1`, `.badge-p2`, `.badge-p3`, `.badge-e1`, `.badge-e2`

**Option-set values (tenant-specific to Packet Fusion — fusionflow may differ, verify against its own D365 metadata):**

`severitycode`:
| Value       | Label |
|-------------|-------|
| 1           | P1    |
| 173590000   | P2    |
| 173590001   | P3 (default for new cases) |
| 100000000   | E1    |
| 100000001   | E2    |

`statuscode` (for reference — portal reads labels from FormattedValue, not this map):
- state 0 (Active): 1=New, 173590014=Re-Opened, 2=Waiting on Customer, 3=Waiting on Packet Fusion, 173590001=Waiting on Vendor, 173590002=Waiting on Upgrade/Software Release, 173590010=Waiting on RMA, 173590015=Project Assigned, 173590016=Project Scheduled, 173590017=Project Complete, 173590018=Project On Hold
- state 1 (Resolved): 173590009=Closed Break Fix, 173590008=Closed MAC, 1000=Closed RMA, 173590007=Closed Install
- state 2 (Cancelled): 6=Canceled, 2000=Merged

**Inspecting picklists for a different tenant:** This query returns option
values + labels; call it as an internal user if fusionflow's values differ:

```
GET {d365 base}/EntityDefinitions(LogicalName='incident')/Attributes(LogicalName='severitycode')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)
```

Use `StatusAttributeMetadata` for `statuscode`. Labels live at
`OptionSet.Options[].Label.UserLocalizedLabel.Label`. (We added and then
removed a `/api/portal/cases/metadata/picklists` helper that wraps these —
easy to reintroduce if needed; see commit `934f343` for the shape.)

## 3. Put On Hold button removed

**Problem:** CRM auto-transitions cases to "Waiting on Customer"
(statuscode=2) when a customer replies, so the manual hold button was
redundant. Also mislabeled after the Severity sync (old code treated
statuscode=2 as "On Hold", which was incorrect terminology).

**Change:**
- Remove the button from `CaseDetailPage` status-update block.
- Remove the corresponding `hold` case from the backend status endpoint.
- Keep the "Mark In Progress" reverse button (engineer-initiated flip back to `New` when a customer responds out-of-band — statuscode=1).

**Files touched:**
- `src/react-app/pages/CaseDetailPage.tsx` — drop the Put On Hold branch in `.status-actions`.
- `src/worker/routes/cases.ts` — drop the `body.action === "hold"` branch.

Note: `isOnHold = statuscode === 2` variable name is now semantically
"Waiting on Customer". Left as-is to minimize churn, but worth renaming if
you're already editing that file.

---

## Sanity checks after porting

- [ ] As a customer on a resolved/cancelled case closed within 30 days: Reopen button appears, works, and records a note.
- [ ] As a customer on a resolved case closed >30 days ago: no buttons visible; direct API call to `/status` returns 403.
- [ ] As a customer opening a new case: Severity dropdown shows only P1/P2/P3.
- [ ] As internal staff opening a new case: dropdown shows P1/P2/P3/E1/E2.
- [ ] Case list + detail pages show real CRM statuscode labels (e.g. "Waiting on Customer", not "On Hold").
- [ ] Internal users: status update panel still works for Resolve, Reopen, Mark In Progress, Cancel. No Put On Hold button.
