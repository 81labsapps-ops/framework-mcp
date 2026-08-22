import { Pool } from "pg";

let _pool: Pool | null = null;

export function getDb(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL env var is required");
  _pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: true },
  });
  return _pool;
}
