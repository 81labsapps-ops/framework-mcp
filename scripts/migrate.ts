import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = getDb();
const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf-8");

async function main() {
  await db.query(schema);
  console.log("Migration applied against", process.env.DATABASE_URL?.split("@")[1] ?? "DATABASE_URL");
  await db.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
