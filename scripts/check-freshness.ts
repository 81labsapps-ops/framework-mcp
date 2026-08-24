// Compares the version we've pinned per framework (is_current=true in DB)
// against the latest version actually published on npm. Read-only - it never
// writes. A mismatch means our curated seed content is stale and needs a
// human to review + re-seed, not an automated rewrite (that would defeat the
// "verified" promise that's the whole point of this product over Context7).
import { getDb } from "../src/db.js";

// npm package used as a version proxy for each framework slug. Supabase has
// no single "framework version" the way the others do, so we track the JS
// client library as the closest proxy - noted as a caveat in the report.
const NPM_PROXY: Record<string, string> = {
  expo: "expo",
  nextjs: "next",
  supabase: "@supabase/supabase-js",
  prisma: "prisma",
  "vercel-ai-sdk": "ai",
  nuxt: "nuxt",
};

async function latestNpmVersion(pkg: string): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
  if (!res.ok) throw new Error(`npm registry lookup failed for ${pkg}: ${res.status}`);
  const json = (await res.json()) as { version: string };
  return json.version;
}

function majorOf(version: string): string {
  return version.split(".")[0];
}

async function main() {
  const db = getDb();
  const { rows } = await db.query<{ slug: string; name: string; version: string }>(
    `SELECT f.slug, f.name, v.version
     FROM frameworks f
     JOIN versions v ON v.framework_id = f.id AND v.is_current = true`
  );

  const results: { slug: string; name: string; pinned: string; latest: string | null; stale: boolean; note?: string }[] = [];

  for (const row of rows) {
    const pkg = NPM_PROXY[row.slug];
    if (!pkg) {
      results.push({ slug: row.slug, name: row.name, pinned: row.version, latest: null, stale: false, note: "no npm proxy configured" });
      continue;
    }
    try {
      const latest = await latestNpmVersion(pkg);
      const stale = majorOf(latest) !== majorOf(row.version);
      results.push({ slug: row.slug, name: row.name, pinned: row.version, latest, stale });
    } catch (err) {
      results.push({ slug: row.slug, name: row.name, pinned: row.version, latest: null, stale: false, note: `lookup failed: ${(err as Error).message}` });
    }
  }

  const stale = results.filter((r) => r.stale);
  console.log("Framework freshness check (major version compare, DB pinned vs npm latest):\n");
  for (const r of results) {
    const flag = r.stale ? "STALE" : r.note ? "SKIP " : "OK   ";
    console.log(`[${flag}] ${r.name.padEnd(20)} pinned=${r.pinned.padEnd(12)} latest=${(r.latest ?? "?").padEnd(12)} ${r.note ?? ""}`);
  }
  console.log(`\n${stale.length} framework(s) need a re-seed review.`);

  await db.end();
  process.exit(stale.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
