import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";

export function registerQueryFrameworkDocTool(server: McpServer, db: Database.Database) {
  server.registerTool(
    "query_framework_doc",
    {
      title: "Query Framework Doc",
      description:
        "Looks up a verified, version-pinned answer about a fast-moving framework (e.g. Expo SDK). " +
        "Pass the exact pinned version, not a range. Returns the best-matching answer, its source_url, " +
        "and a query_id - call report_outcome with that query_id afterward to say whether it actually worked.",
      inputSchema: {
        framework: z.string().min(1).describe("Framework slug, e.g. 'expo'"),
        version: z.string().min(1).describe("Exact pinned version, e.g. '54.0.0'"),
        question: z.string().min(3).describe("Natural-language question about this framework/version"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ framework, version, question }) => {
      const clientInfo = server.server.getClientVersion();

      // naive but correct FTS5 fuzzy match: OR every alphanumeric token
      const terms = question.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
      const matchQuery = terms.length ? terms.map((t) => `"${t}"`).join(" OR ") : question;

      const row = db
        .prepare(
          `SELECT e.id, e.question, e.answer, e.source_url, bm25(entries_fts) AS rank
           FROM entries_fts
           JOIN entries e ON e.id = entries_fts.rowid
           JOIN versions v ON v.id = e.version_id
           JOIN frameworks f ON f.id = e.framework_id
           WHERE entries_fts MATCH ? AND f.slug = ? AND v.version = ?
           ORDER BY rank
           LIMIT 1`
        )
        .get(matchQuery, framework, version) as
        | { id: number; question: string; answer: string; source_url: string }
        | undefined;

      const insertQuery = db.prepare(`
        INSERT INTO queries (client_name, client_version, framework, version, question_text, matched_entry_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = insertQuery.run(
        clientInfo?.name ?? null,
        clientInfo?.version ?? null,
        framework,
        version,
        question,
        row?.id ?? null
      );
      const queryId = Number(result.lastInsertRowid);

      if (!row) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  matched: false,
                  query_id: queryId,
                  message: `No verified entry found for ${framework}@${version}. Check available versions/entries, or fall back to the live docs.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                matched: true,
                query_id: queryId,
                answer: row.answer,
                source_url: row.source_url,
                matched_question: row.question,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
