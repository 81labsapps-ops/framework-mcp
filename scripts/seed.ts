import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { getDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(__dirname, "..", "db", "seed");
const explicitPath = process.argv[2];
const seedPaths = explicitPath
  ? [explicitPath]
  : fs
      .readdirSync(seedDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(seedDir, f));

const db = getDb();

async function seedOne(client: PoolClient, seedPath: string) {
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

  const frameworkResult = await client.query<{ id: number }>(
    `INSERT INTO frameworks (slug, name, docs_base_url) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, docs_base_url = EXCLUDED.docs_base_url
     RETURNING id`,
    [seed.framework.slug, seed.framework.name, seed.framework.docs_base_url]
  );
  const frameworkId = frameworkResult.rows[0].id;

  const versionResult = await client.query<{ id: number }>(
    `INSERT INTO versions (framework_id, version, docs_url, is_current, released_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (framework_id, version) DO UPDATE SET
       docs_url = EXCLUDED.docs_url, is_current = EXCLUDED.is_current, released_at = EXCLUDED.released_at
     RETURNING id`,
    [frameworkId, seed.version.version, seed.version.docs_url, seed.version.is_current, seed.version.released_at]
  );
  const versionId = versionResult.rows[0].id;

  for (const e of seed.entries) {
    await client.query(
      `INSERT INTO entries (framework_id, version_id, question, answer, source_url, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (version_id, question) DO UPDATE SET
         answer = EXCLUDED.answer, source_url = EXCLUDED.source_url,
         verified_at = EXCLUDED.verified_at, updated_at = now()`,
      [frameworkId, versionId, e.question, e.answer, e.source_url, e.verified_at]
    );
  }

  console.log(`Seeded ${seed.entries.length} entries for ${seed.framework.slug}@${seed.version.version}`);
}

async function main(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const seedPath of seedPaths) {
      await seedOne(client, seedPath);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main(db).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
