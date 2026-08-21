# framework-mcp

Local MCP server that gives coding agents (Claude Code, Cursor, etc.) verified,
version-pinned answers about fast-moving frameworks — starting with Expo SDK 54.

Why: LLM training data goes stale faster than framework release cycles. Agents
keep re-guessing the same version-specific questions instead of checking a
verified, version-pinned source. This server is that source.

## Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run build
```

## Verify with MCP Inspector (no Claude Code needed)

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Connect to Claude Code

```bash
claude mcp add --transport stdio framework-mcp -- node C:\projeler\framework-mcp\dist\index.js
```

Then run `/mcp` inside a Claude Code session to confirm it's connected.

## Tools

- `ping(message)` — health check
- `query_framework_doc(framework, version, question)` — look up a verified answer, returns `query_id`
- `report_outcome(query_id, worked, note?)` — log whether the returned answer actually worked

## Status

Seed data in `db/seed/expo-54.json` is marked `verified_at: "PLACEHOLDER-CONFIRM-AGAINST-LIVE-DOCS"` —
confirm each entry against https://docs.expo.dev/versions/v54.0.0/ and
https://expo.dev/changelog/sdk-54 before trusting it, then update `verified_at`.

Deferred (not built yet): remote hosting, billing, embeddings/semantic search,
other frameworks, scoring/ranking on feedback.
