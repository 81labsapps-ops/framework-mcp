#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./db.js";
import { registerPingTool } from "./tools/ping.js";
import { registerQueryFrameworkDocTool } from "./tools/queryFrameworkDoc.js";
import { registerReportOutcomeTool } from "./tools/reportOutcome.js";

const server = new McpServer({ name: "framework-mcp", version: "0.1.0" });
const db = getDb();

registerPingTool(server);
registerQueryFrameworkDocTool(server, db);
registerReportOutcomeTool(server, db);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // IMPORTANT: stdout is reserved for JSON-RPC framing over stdio.
  // Any logging must go to stderr, never console.log/stdout.
  console.error("framework-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting framework-mcp:", err);
  process.exit(1);
});
