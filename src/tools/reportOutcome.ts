import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";

export function registerReportOutcomeTool(server: McpServer, db: Database.Database) {
  server.registerTool(
    "report_outcome",
    {
      title: "Report Outcome",
      description:
        "Logs whether the answer from a prior query_framework_doc call actually worked once used in code. " +
        "Pure data collection for MVP - no scoring logic yet.",
      inputSchema: {
        query_id: z.number().int().describe("The query_id returned by query_framework_doc"),
        worked: z.boolean().describe("Whether the returned answer was correct/useful"),
        note: z.string().optional().describe("Optional note on what was actually different, if anything"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ query_id, worked, note }) => {
      db.prepare(`INSERT INTO feedback (query_id, worked, note) VALUES (?, ?, ?)`).run(
        query_id,
        worked ? 1 : 0,
        note ?? null
      );
      return {
        content: [{ type: "text", text: `Logged feedback for query_id ${query_id}: worked=${worked}` }],
      };
    }
  );
}
