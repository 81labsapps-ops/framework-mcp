// Surfaces report_outcome feedback so a human can actually act on it - right
// now that data lands in the `feedback` table and nothing ever reads it back.
// This does not auto-edit seed content; it just makes negative feedback
// visible so a curator can fix the underlying entry.
import { getDb } from "../src/db.js";

const DAYS = Number(process.argv[2] ?? 7);

async function main() {
  const db = getDb();
  const { rows } = await db.query<{
    worked: boolean;
    note: string | null;
    created_at: string;
    framework: string;
    version: string;
    question_text: string;
  }>(
    `SELECT fb.worked, fb.note, fb.created_at, q.framework, q.version, q.question_text
     FROM feedback fb
     JOIN queries q ON q.id = fb.query_id
     WHERE fb.created_at > now() - ($1 || ' days')::interval
     ORDER BY fb.created_at DESC`,
    [DAYS]
  );

  const failed = rows.filter((r) => !r.worked);
  const worked = rows.filter((r) => r.worked);

  console.log(`Outcome digest - last ${DAYS} day(s): ${rows.length} report(s) (${worked.length} worked, ${failed.length} failed)\n`);

  if (failed.length === 0) {
    console.log("No negative feedback in this window.");
  } else {
    console.log("Needs review (worked=false):\n");
    for (const r of failed) {
      console.log(`- [${r.framework} ${r.version}] "${r.question_text}"`);
      if (r.note) console.log(`  note: ${r.note}`);
      console.log(`  reported_at: ${r.created_at}`);
    }
  }

  await db.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
