# Packet Fusion Support Portal

A customer-facing support portal built on React, Hono, and Cloudflare Workers, backed by Dynamics 365 CRM.

## Stack

- **React + TypeScript + Vite** — frontend
- **Hono** — API layer running on Cloudflare Workers
- **Dynamics 365** — case and contact data
- **Cloudflare Access** — authentication
- **Cloudflare KV** — session and token caching

## Features

- Customer and internal user login via Cloudflare Access
- Submit and track support cases
- View case activity feed with notes and attachments
- Internal users can open cases on behalf of customer accounts
- **Zoom Team Chat notifications** — a message is posted to the support channel whenever a new case is opened, including the customer name, case summary, submitter, and a direct CRM link

## Environment Variables

| Variable | Description |
|---|---|
| `D365_CLIENT_ID` | Dynamics 365 app registration client ID |
| `D365_CLIENT_SECRET` | Dynamics 365 app registration client secret |
| `D365_TENANT_ID` | Azure AD tenant ID |
| `CF_ACCESS_AUD` | Cloudflare Access application audience tag |
| `CF_TEAM_DOMAIN` | Cloudflare Access team domain |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ZOOM_WEBHOOK_URL` | Zoom incoming webhook endpoint URL |
| `ZOOM_WEBHOOK_SECRET` | Zoom incoming webhook signing secret |

## Development

```bash
npm install
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173).

## Deployment

```bash
npm run build && npm run deploy
```

Monitor live worker logs:

```bash
npx wrangler tail
```

## Release Notes

### April 2026
- **Zoom Team Chat notifications** — new cases posted to the support channel in real time with customer name, case summary, submitter, and CRM deep link
- Redirect `/Login.aspx` to home page for legacy provider links
- Show more/less toggle on long notes in the activity feed
- Strip HTML from email bodies; suppress TAC-Update notification emails
- Show attachments alongside case notes in the portal
