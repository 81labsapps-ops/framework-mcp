import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "pg";

export function registerQueryFrameworkDocTool(server: McpServer, db: Pool) {
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
    async ({ framework, version, question }, extra) => {
      const clientInfo = server.server.getClientVersion();
      const apiKeyId = (extra.authInfo?.extra?.apiKeyId as string | undefined) ?? null;

      const terms = question.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
      const searchExpr = terms.length ? terms.join(" or ") : question;

      const { rows } = await db.query<{
        id: number;
        question: string;
        answer: string;
        source_url: string;
      }>(
        `SELECT e.id, e.question, e.answer, e.source_url,
                ts_rank_cd(e.search_vector, websearch_to_tsquery('english', $1)) AS rank
           FROM entries e
           JOIN versions v ON v.id = e.version_id
           JOIN frameworks f ON f.id = e.framework_id
          WHERE e.search_vector @@ websearch_to_tsquery('english', $1)
            AND f.slug = $2 AND v.version = $3
          ORDER BY rank DESC
          LIMIT 1`,
        [searchExpr, framework, version]
      );
      const row = rows[0];

      // pg returns bigint (queries.id is BIGSERIAL) columns as strings, not numbers
      const insertResult = await db.query<{ id: string }>(
        `INSERT INTO queries (api_key_id, client_name, client_version, framework, version, question_text, matched_entry_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          apiKeyId,
          clientInfo?.name ?? null,
          clientInfo?.version ?? null,
          framework,
          version,
          question,
          row?.id ?? null,
        ]
      );
      const queryId = Number(insertResult.rows[0].id);

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
