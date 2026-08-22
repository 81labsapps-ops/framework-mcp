#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { getDb } from "./db.js";
import { apiKeyAuthMiddleware } from "./auth/bearerAuthMiddleware.js";
import { signupRateLimit } from "./auth/signupRateLimit.js";
import { signupHandler } from "./routes/signup.js";
import { registerPingTool } from "./tools/ping.js";
import { registerListFrameworksTool } from "./tools/listFrameworks.js";
import { registerQueryFrameworkDocTool } from "./tools/queryFrameworkDoc.js";
import { registerReportOutcomeTool } from "./tools/reportOutcome.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = getDb();
const isProd = process.env.NODE_ENV === "production";

// No allowedHosts restriction: Railway's own internal healthcheck probe
// doesn't send the public domain as its Host header, so restricting to
// PUBLIC_HOSTNAME here made Railway's healthcheck itself fail with a 403
// and roll back every deploy. /mcp is already protected by real bearer-token
// auth (apiKeyAuthMiddleware below), so the extra DNS-rebinding host check
// isn't adding meaningful protection in production - just breaking healthchecks.
const app = createMcpExpressApp({
  host: isProd ? "0.0.0.0" : "127.0.0.1",
});

// Railway sits in front as a single reverse-proxy hop; without this, every
// request's IP collapses to the proxy's IP and the signup rate limiter
// becomes useless. Trust exactly one hop, not a blanket `true`.
app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.post("/signup", signupRateLimit, signupHandler(db));

app.use(apiKeyAuthMiddleware(db));

const transports: Record<string, StreamableHTTPServerTransport> = {};

function buildServer(): McpServer {
  const server = new McpServer({ name: "framework-mcp", version: "0.3.0" });
  registerPingTool(server);
  registerListFrameworksTool(server, db);
  registerQueryFrameworkDocTool(server, db);
  registerReportOutcomeTool(server, db);
  return server;
}

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport = sessionId ? transports[sessionId] : undefined;

  if (!transport && !sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport!;
      },
    });
    transport.onclose = () => {
      if (transport!.sessionId) {
        delete transports[transport!.sessionId];
      }
    };
    await buildServer().connect(transport);
  } else if (!transport) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "No valid session ID provided" },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transport.handleRequest(req, res);
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`framework-mcp listening on :${port}`);
});
