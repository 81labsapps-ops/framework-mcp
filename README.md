# framework-mcp

A dependency currency-check layer for coding agents: a remote MCP server that
gives coding agents (Claude Code, Cursor, etc.) verified, version-pinned
answers about fast-moving frameworks - Expo, Next.js, Supabase, Prisma, and
growing.

Why: LLM training data goes stale faster than framework release cycles. Agents
keep re-guessing the same version-specific questions instead of checking a
verified, version-pinned source. This server is that source - not a
single-framework tool, but a general layer any coding agent can query before
trusting what it "remembers" about a dependency's current behavior.

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

## Get an API key

Self-service: visit **https://framework-mcp-production.up.railway.app/**, enter
an email, get a key instantly (one active key per email, rate-limited).

Maintainer/local fallback: `npm run create-api-key -- "label"`.

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
- `list_frameworks()` - lists every framework/version covered, with entry counts - call this first if you don't know the exact slug/version to pass below
- `query_framework_doc(framework, version, question)` - look up a verified answer, returns `query_id`
- `report_outcome(query_id, worked, note?)` - log whether the returned answer actually worked

## Coverage

| Framework | Version | Entries | Source |
|---|---|---|---|
| Expo SDK | 54.0.0 | 20 | expo.dev/changelog/sdk-54 |
| Next.js | 16.3.2 | 20 | nextjs.org/blog, nextjs.org/docs upgrade guide |
| Supabase (supabase-js) | 2.112.3 | 20 | supabase.com/changelog, GitHub releases |
| Prisma ORM | 7.9.1 | 20 | prisma.io/docs upgrade guide, prisma.io/changelog |
| Vercel AI SDK | 7.0.77 | 20 | ai-sdk.dev migration guides, vercel.com/blog |
| Nuxt | 4.5.2 | 20 | nuxt.com/docs upgrade guide, nuxt.com/blog |

All entries verified 2026-08-22 against the official sources cited in each
seed file under `db/seed/`. To add a framework: create a new
`db/seed/<slug>.json` following the existing files' shape, then `npm run
db:seed` (it picks up every `*.json` in that folder automatically).

## Status

Self-service signup live at `/` (email -> instant API key, one per email,
IP rate-limited). Published to the official MCP Registry
(registry.modelcontextprotocol.io) and submitted to mcpservers.org and Glama
(both pending review). Not on Smithery (their OAuth-discovery scanner doesn't
support simple static bearer-key auth) or mcp.so (no free listing tier).

Deferred (Stage B, not built yet): Stripe billing, `plan_tier` /
`credit_balance` / rate-limit-enforcement-per-key on `api_keys`,
scoring/ranking on feedback.
