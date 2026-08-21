import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = getDb();
const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf-8");
db.exec(schema);
console.log("Migration applied:", process.env.FRAMEWORK_MCP_DB_PATH ?? "data/framework-mcp.db");
