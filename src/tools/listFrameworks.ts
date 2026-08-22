import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "pg";

export function registerListFrameworksTool(server: McpServer, db: Pool) {
  server.registerTool(
    "list_frameworks",
    {
      title: "List Frameworks",
      description:
        "Lists every framework and version this server has verified answers for, with an entry count per " +
        "version. Call this first if you don't already know the exact framework slug and version to pass " +
        "to query_framework_doc - version strings must match exactly (e.g. '15.4.0', not '15' or 'latest').",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const { rows } = await db.query<{
        slug: string;
        name: string;
        version: string;
        is_current: boolean;
        entry_count: string;
      }>(
        `SELECT f.slug, f.name, v.version, v.is_current, count(e.id) AS entry_count
           FROM frameworks f
           JOIN versions v ON v.framework_id = f.id
           LEFT JOIN entries e ON e.version_id = v.id
          GROUP BY f.slug, f.name, v.version, v.is_current
          ORDER BY f.name, v.version`
      );

      const byFramework: Record<string, { name: string; versions: Array<Record<string, unknown>> }> = {};
      for (const row of rows) {
        byFramework[row.slug] ??= { name: row.name, versions: [] };
        byFramework[row.slug].versions.push({
          version: row.version,
          is_current: row.is_current,
          entry_count: Number(row.entry_count),
        });
      }

      return {
        content: [{ type: "text", text: JSON.stringify(byFramework, null, 2) }],
      };
    }
  );
}
