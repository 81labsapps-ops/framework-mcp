PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS frameworks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,          -- 'expo'
  name          TEXT NOT NULL,                 -- 'Expo SDK'
  docs_base_url TEXT NOT NULL,                 -- 'https://docs.expo.dev/versions/'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  version      TEXT NOT NULL,                  -- '54.0.0'
  docs_url     TEXT NOT NULL,                  -- 'https://docs.expo.dev/versions/v54.0.0/'
  is_current   INTEGER NOT NULL DEFAULT 0,     -- 0/1 boolean
  released_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (framework_id, version)
);

CREATE TABLE IF NOT EXISTS entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  version_id   INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  verified_at  TEXT NOT NULL,                  -- date a human/agent confirmed vs live docs
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (version_id, question)
);

CREATE INDEX IF NOT EXISTS idx_entries_version ON entries(version_id);

-- External-content FTS5 index over question+answer
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  question,
  answer,
  content = 'entries',
  content_rowid = 'id',
  tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, question, answer) VALUES (new.id, new.question, new.answer);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, question, answer) VALUES ('delete', old.id, old.question, old.answer);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, question, answer) VALUES ('delete', old.id, old.question, old.answer);
  INSERT INTO entries_fts(rowid, question, answer) VALUES (new.id, new.question, new.answer);
END;

CREATE TABLE IF NOT EXISTS queries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name       TEXT,               -- initialize handshake clientInfo.name
  client_version    TEXT,               -- initialize handshake clientInfo.version
  framework         TEXT NOT NULL,
  version           TEXT NOT NULL,
  question_text     TEXT NOT NULL,
  matched_entry_id  INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  query_id   INTEGER NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  worked     INTEGER NOT NULL,          -- 0/1 boolean
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
