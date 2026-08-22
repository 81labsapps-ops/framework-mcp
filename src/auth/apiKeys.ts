import crypto from "node:crypto";
import type { Pool } from "pg";

function getPepper(): string {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) throw new Error("API_KEY_PEPPER env var is required");
  return pepper;
}

export function generateApiKey(): { raw: string; prefix: string } {
  const raw = "fmk_live_" + crypto.randomBytes(24).toString("base64url");
  return { raw, prefix: raw.slice(0, 16) };
}

export function hashApiKey(raw: string): string {
  return crypto.createHmac("sha256", getPepper()).update(raw).digest("hex");
}

export interface ApiKeyRecord {
  id: string;
  revoked_at: string | null;
}

export async function verifyApiKey(pool: Pool, token: string): Promise<ApiKeyRecord | null> {
  const hash = hashApiKey(token);
  const { rows } = await pool.query<ApiKeyRecord>(
    `SELECT id, revoked_at FROM api_keys WHERE key_hash = $1`,
    [hash]
  );
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  await pool.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [row.id]);
  return row;
}
