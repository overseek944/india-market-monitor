import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(path.join(DATA_DIR, "monitor.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const rawDb = sqlite;

/**
 * Idempotent bootstrap. For a local single-user terminal we don't need a migration
 * runner; this direct SQL keeps `npm run dev` zero-config on first run. Partial unique
 * indexes give us correct dedup for BOTH per-instrument and market-wide articles
 * (SQLite treats every NULL as distinct, so a plain unique index on instrument_id
 * would not dedup market-wide rows — hence two scoped indexes).
 */
export function ensureSchema(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT,
      isin TEXT,
      bse_code TEXT,
      sector TEXT,
      industry TEXT,
      series TEXT,
      added_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_polled_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ix_instrument_symbol ON instruments(symbol);
    CREATE INDEX IF NOT EXISTS ix_instrument_isin ON instruments(isin);

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
      market_wide INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      canonical_url TEXT,
      description TEXT,
      author TEXT,
      published_at INTEGER,
      ingested_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      relevance INTEGER,
      sentiment TEXT,
      category TEXT,
      thesis_impact TEXT,
      novelty INTEGER,
      scored_at INTEGER,
      duplicate_of INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ix_article_dedupe
      ON articles(instrument_id, source, external_id) WHERE instrument_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ix_article_market_dedupe
      ON articles(source, external_id) WHERE instrument_id IS NULL;
    CREATE INDEX IF NOT EXISTS ix_article_instrument_published
      ON articles(instrument_id, published_at);
    CREATE INDEX IF NOT EXISTS ix_article_market_published
      ON articles(market_wide, published_at);
    CREATE INDEX IF NOT EXISTS ix_article_source ON articles(source);
    CREATE INDEX IF NOT EXISTS ix_article_duplicate_of ON articles(duplicate_of);

    CREATE TABLE IF NOT EXISTS market_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL UNIQUE,
      data_json TEXT NOT NULL,
      captured_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS custom_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'all',
      last_polled_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'all',
      min_relevance INTEGER NOT NULL DEFAULT 7,
      sentiment_filter TEXT,
      category_filter TEXT,
      channel TEXT NOT NULL,
      channel_config TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      fired_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      success INTEGER NOT NULL,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_alert_log_alert_article
      ON alert_log(alert_id, article_id);

    -- Full-text search across title + description + thesis_impact
    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title, description, thesis_impact,
      content='articles', content_rowid='id', tokenize='porter unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS articles_ai_fts AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, description, thesis_impact)
      VALUES (new.id, new.title, new.description, new.thesis_impact);
    END;
    CREATE TRIGGER IF NOT EXISTS articles_ad_fts AFTER DELETE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, description, thesis_impact)
      VALUES('delete', old.id, old.title, old.description, old.thesis_impact);
    END;
    CREATE TRIGGER IF NOT EXISTS articles_au_fts AFTER UPDATE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, description, thesis_impact)
      VALUES('delete', old.id, old.title, old.description, old.thesis_impact);
      INSERT INTO articles_fts(rowid, title, description, thesis_impact)
      VALUES (new.id, new.title, new.description, new.thesis_impact);
    END;
  `);
}
