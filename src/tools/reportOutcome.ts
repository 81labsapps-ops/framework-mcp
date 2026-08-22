import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "pg";

export function registerReportOutcomeTool(server: McpServer, db: Pool) {
  server.registerTool(
    "report_outcome",
    {
      title: "Report Outcome",
      description:
        "Logs whether the answer from a prior query_framework_doc call actually worked once used in code. " +
        "Pure data collection for MVP - no scoring logic yet.",
      inputSchema: {
        query_id: z.coerce.number().int().describe("The query_id returned by query_framework_doc"),
        worked: z.boolean().describe("Whether the returned answer was correct/useful"),
        note: z.string().optional().describe("Optional note on what was actually different, if anything"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ query_id, worked, note }) => {
      await db.query(`INSERT INTO feedback (query_id, worked, note) VALUES ($1, $2, $3)`, [
        query_id,
        worked,
        note ?? null,
      ]);
      return {
        content: [{ type: "text", text: `Logged feedback for query_id ${query_id}: worked=${worked}` }],
      };
    }
  );
}
