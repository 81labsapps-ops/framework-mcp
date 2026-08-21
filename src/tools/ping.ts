import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPingTool(server: McpServer) {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Health-check tool. Echoes back a message. Use this to confirm the MCP server connection is wired correctly before relying on any other tool.",
      inputSchema: {
        message: z.string().default("pong").describe("Text to echo back"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ message }) => ({
      content: [{ type: "text", text: `pong: ${message}` }],
    })
  );
}
