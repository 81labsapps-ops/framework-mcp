import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = process.argv[2] ?? path.join(__dirname, "..", "db", "seed", "expo-54.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
const db = getDb();

const upsertFramework = db.prepare(`
  INSERT INTO frameworks (slug, name, docs_base_url) VALUES (@slug, @name, @docs_base_url)
  ON CONFLICT(slug) DO UPDATE SET name = excluded.name, docs_base_url = excluded.docs_base_url
`);
const getFrameworkId = db.prepare(`SELECT id FROM frameworks WHERE slug = ?`);
const upsertVersion = db.prepare(`
  INSERT INTO versions (framework_id, version, docs_url, is_current, released_at)
  VALUES (@framework_id, @version, @docs_url, @is_current, @released_at)
  ON CONFLICT(framework_id, version) DO UPDATE SET
    docs_url = excluded.docs_url, is_current = excluded.is_current, released_at = excluded.released_at
`);
const getVersionId = db.prepare(`SELECT id FROM versions WHERE framework_id = ? AND version = ?`);
const upsertEntry = db.prepare(`
  INSERT INTO entries (framework_id, version_id, question, answer, source_url, verified_at)
  VALUES (@framework_id, @version_id, @question, @answer, @source_url, @verified_at)
  ON CONFLICT(version_id, question) DO UPDATE SET
    answer = excluded.answer, source_url = excluded.source_url,
    verified_at = excluded.verified_at, updated_at = datetime('now')
`);

const tx = db.transaction(() => {
  upsertFramework.run(seed.framework);
  const frameworkId = (getFrameworkId.get(seed.framework.slug) as { id: number }).id;
  upsertVersion.run({
    framework_id: frameworkId,
    ...seed.version,
    is_current: seed.version.is_current ? 1 : 0,
  });
  const versionId = (getVersionId.get(frameworkId, seed.version.version) as { id: number }).id;
  for (const e of seed.entries) {
    upsertEntry.run({ framework_id: frameworkId, version_id: versionId, ...e });
  }
});
tx();
console.log(`Seeded ${seed.entries.length} entries for ${seed.framework.slug}@${seed.version.version}`);
