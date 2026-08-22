# framework-mcp

Remote MCP server that gives coding agents (Claude Code, Cursor, etc.) verified,
version-pinned answers about fast-moving frameworks - starting with Expo SDK 54.

Why: LLM training data goes stale faster than framework release cycles. Agents
keep re-guessing the same version-specific questions instead of checking a
verified, version-pinned source. This server is that source.

## Stack

Node 24 + TypeScript, `@modelcontextprotocol/sdk` over **Streamable HTTP**
transport (stateful, session-per-connection), Express, Postgres (`pg`),
API-key auth via the SDK's own `requireBearerAuth` middleware.

Hosting: [Railway](https://railway.com) (compute, ~$5/mo Hobby plan) +
[Neon](https://neon.tech) (Postgres, free tier, branchable).

## Local setup

1. Create a free [Neon](https://neon.tech) account and project. Copy the
   connection string for a `dev` branch.
2. `cp .env.example .env` and fill in `DATABASE_URL` (from Neon) and
   `API_KEY_PEPPER` (any long random string - generate one with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. Install, migrate, seed, build:
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run build
   ```
4. Create yourself an API key:
   ```bash
   npm run create-api-key -- "my laptop"
   ```
   This prints the raw key **once** - save it, it's not recoverable.
5. Run locally:
   ```bash
   npm run dev
   ```
   `curl http://localhost:3000/health` should return `ok`.

## Verify with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```
Connect to `http://localhost:3000/mcp` with transport "Streamable HTTP" and
set an `Authorization: Bearer <your-api-key>` header in the connection
settings. Confirm all 3 tools (`ping`, `query_framework_doc`,
`report_outcome`) list and are callable.

## Deploy to Railway

1. `curl -fsSL agents.railway.com | sh` then `railway login`.
2. From this repo: `railway init` (or `railway link` if a project already
   exists).
3. Set env vars (dashboard, or `railway variable set KEY=value`):
   `DATABASE_URL` (your Neon **production** branch connection string,
   separate from your dev branch), `API_KEY_PEPPER`, `NODE_ENV=production`.
4. `railway up`.
5. In the Railway dashboard: Settings → Networking → Generate Domain. Set
   `PUBLIC_HOSTNAME` to that domain (needed for the SDK's DNS-rebinding host
   check to allow real traffic).
6. Run `npm run db:migrate && npm run db:seed` once against the production
   `DATABASE_URL` (from your machine, pointed at the prod connection string).
7. Create a production API key with `npm run create-api-key`, pointed at the
   prod `DATABASE_URL`.

## Connect a remote client

In a Claude Code `.mcp.json`:
```json
{
  "mcpServers": {
    "framework-mcp": {
      "type": "http",
      "url": "https://<your-railway-domain>/mcp",
      "headers": { "Authorization": "Bearer <your-api-key>" }
    }
  }
}
```

## Tools

- `ping(message)` - health check
- `query_framework_doc(framework, version, question)` - look up a verified answer, returns `query_id`
- `report_outcome(query_id, worked, note?)` - log whether the returned answer actually worked

## Status

Seed data in `db/seed/expo-54.json` (20 entries) verified against
https://expo.dev/changelog/sdk-54 and https://docs.expo.dev/modules/autolinking/
on 2026-08-21.

Deferred (Stage B, not built yet): Stripe billing, `plan_tier` /
`credit_balance` / rate-limit enforcement on `api_keys`, other frameworks,
scoring/ranking on feedback, a marketing landing page.
