import { getDb } from "../src/db.js";
import { generateApiKey, hashApiKey } from "../src/auth/apiKeys.js";

const label = process.argv[2] ?? null;
const ownerEmail = process.argv[3] ?? null;

async function main() {
  const db = getDb();
  const { raw, prefix } = generateApiKey();
  const hash = hashApiKey(raw);

  await db.query(
    `INSERT INTO api_keys (key_prefix, key_hash, owner_email, label) VALUES ($1, $2, $3, $4)`,
    [prefix, hash, ownerEmail, label]
  );

  console.log("API key created. This is shown ONCE - store it now, it is not recoverable:\n");
  console.log(raw);
  console.log(`\nprefix: ${prefix}  label: ${label ?? "(none)"}  owner_email: ${ownerEmail ?? "(none)"}`);

  await db.end();
}

main().catch((err) => {
  console.error("Failed to create API key:", err);
  process.exit(1);
});
