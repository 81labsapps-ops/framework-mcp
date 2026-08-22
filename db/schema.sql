CREATE TABLE IF NOT EXISTS frameworks (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  docs_base_url TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS versions (
  id           SERIAL PRIMARY KEY,
  framework_id INTEGER NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  version      TEXT NOT NULL,
  docs_url     TEXT NOT NULL,
  is_current   BOOLEAN NOT NULL DEFAULT false,
  released_at  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, version)
);

CREATE TABLE IF NOT EXISTS entries (
  id            SERIAL PRIMARY KEY,
  framework_id  INTEGER NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  version_id    INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  verified_at   DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(question, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(answer, '')), 'B')
  ) STORED,
  UNIQUE (version_id, question)
);

CREATE INDEX IF NOT EXISTS idx_entries_version ON entries(version_id);
CREATE INDEX IF NOT EXISTS idx_entries_search_vector ON entries USING GIN (search_vector);

-- api_keys is deliberately minimal for Stage A (no billing). Stage B adds
-- plan_tier / stripe_customer_id / credit_balance / rate_limit_per_minute
-- as pure additive columns later - never a restructure.
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix    TEXT NOT NULL,          -- safe to display/log for identification
  key_hash      TEXT NOT NULL UNIQUE,   -- HMAC-SHA256(rawKey, API_KEY_PEPPER); raw key is never stored
  owner_email   TEXT,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
-- One active key per email for self-service signup. Partial (WHERE owner_email
-- IS NOT NULL) so it never conflicts with existing NULL-email CLI-created keys.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_owner_email_unique
  ON api_keys (owner_email)
  WHERE owner_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS queries (
  id                BIGSERIAL PRIMARY KEY,
  api_key_id        UUID REFERENCES api_keys(id) ON DELETE SET NULL, -- WHO called
  client_name       TEXT,      -- WHICH AGENT called (MCP clientInfo.name)
  client_version    TEXT,
  framework         TEXT NOT NULL,
  version           TEXT NOT NULL,
  question_text     TEXT NOT NULL,
  matched_entry_id  INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_queries_api_key ON queries(api_key_id);

CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL PRIMARY KEY,
  query_id   BIGINT NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  worked     BOOLEAN NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
