/**
 * DealFlow AI — data layer (MVP).
 *
 * SQLite via Bun's built-in `bun:sqlite` — zero extra npm dependencies and no
 * external database service (no DATABASE_URL is available to this team yet).
 * Every table from the product spec is created idempotently at startup, plus a
 * `sessions` table backing the auth cookie.
 *
 * The rest of the app talks to this module only through the `sql()` tagged
 * template helper, so swapping this file for a Supabase/Postgres
 * implementation later (per the product plan) changes one module, not the app.
 *
 * SERVER-ONLY: import and call this ONLY inside `createServerFn()` handlers or
 * `src/routes/api/*` routes — never from client components.
 *
 * Bundling note: this module must remain CLIENT-SAFE at module scope, because
 * this TanStack Start version does not isolate server-only modules from the
 * client graph — server-fn files are client-importable, so their transitive
 * imports land in the browser bundle too. That is why `bun:sqlite` /
 * `node:fs` / `node:path` are loaded dynamically INSIDE the database open
 * function rather than imported at the top. On the client the module loads
 * but nothing ever calls it.
 */
import type { Database, SQLiteBindValue } from "bun:sqlite";

export type SqlRow = Record<string, unknown>;

export interface SqlResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Tagged-template query helper. `sql()` returns a function you call with a
 * template literal — the call returns a Promise, so `await` it:
 *
 *   const rows = await sql()`select id, name from users where email = ${email}`;
 *
 * `.run` / `.insert` execute writes (INSERT/UPDATE/DELETE) and return the
 * statement result / new row id.
 */
export interface SqlTag {
  (strings: TemplateStringsArray, ...params: SQLiteBindValue[]): Promise<SqlRow[]>;
  run(
    strings: TemplateStringsArray,
    ...params: SQLiteBindValue[]
  ): Promise<SqlResult>;
  insert(
    strings: TemplateStringsArray,
    ...params: SQLiteBindValue[]
  ): Promise<number>;
}

let dbPromise: Promise<Database> | null = null;

/** Server-only database path, resolved lazily on the server. */
function dbPath(): string {
  const cwd = process.cwd();
  return `${cwd}/data/dealflow.db`;
}

/**
 * Lazy singleton. Migrations + demo-user seed run once, on first use — which,
 * because this module is part of the server startup graph, is effectively at
 * boot for the published build.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Bun builtins — resolved natively by the Bun runtime on the server.
      const { mkdirSync } = await import("node:fs");
      const { Database } = await import("bun:sqlite");

      const path = process.env.DEALFLOW_DB_PATH ?? dbPath();
      mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });

      const database = new Database(path);
      database.exec("PRAGMA journal_mode = WAL;");
      database.exec("PRAGMA foreign_keys = ON;");
      database.exec("PRAGMA busy_timeout = 5000;");
      runMigrations(database);
      return database;
    })();
  }
  return dbPromise;
}

/* ---------------------------------------------------------------------- */
/* Migrations — idempotent (CREATE TABLE IF NOT EXISTS ...)                */
/* ---------------------------------------------------------------------- */

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    company       TEXT,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_name              TEXT,
    property_address        TEXT,
    city                    TEXT,
    state                   TEXT,
    zip                     TEXT,
    property_type           TEXT,
    estimated_value         REAL,
    estimated_equity        REAL,
    lead_score              INTEGER,
    status                  TEXT,
    ownership_duration_years REAL,
    vacancy_signal          INTEGER,
    needs_work_signal       INTEGER,
    distress_signal         INTEGER,
    absentee_owner_signal   INTEGER,
    recent_listing_withdrawal_signal INTEGER,
    signals_json            TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id)`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id   INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel   TEXT,
    sender    TEXT,
    message   TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS qualification (
    lead_id           INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
    motivation        INTEGER NOT NULL DEFAULT 0 CHECK (motivation BETWEEN 0 AND 5),
    timeline          INTEGER NOT NULL DEFAULT 0 CHECK (timeline BETWEEN 0 AND 5),
    condition         INTEGER NOT NULL DEFAULT 0 CHECK (condition BETWEEN 0 AND 5),
    price_flexibility INTEGER NOT NULL DEFAULT 0 CHECK (price_flexibility BETWEEN 0 AND 5),
    contactability    INTEGER NOT NULL DEFAULT 0 CHECK (contactability BETWEEN 0 AND 5),
    total_score       INTEGER NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 25)
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    date       TEXT,
    time       TEXT,
    status     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS deals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id          INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    purchase_price   REAL,
    rehab            REAL,
    arv              REAL,
    closing_costs    REAL,
    holding_costs    REAL,
    selling_costs    REAL,
    estimated_profit REAL,
    roi              REAL
  )`,
  // Auth: httpOnly signed session cookie backed by this table.
  `CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`,
];

function runMigrations(database: Database): void {
  for (const ddl of MIGRATIONS) database.exec(ddl);
  ensureLeadColumns(database);
  seedDemoUser(database);
}

/**
 * Idempotent column backfills for the `leads` table (milestone 2 shipped
 * after the table already existed in some databases, so the CREATE TABLE
 * above is not enough — ALTER TABLE if and only if the column is missing).
 */
function ensureLeadColumns(database: Database): void {
  const columns = database
    .query("PRAGMA table_info(leads)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((c) => c.name));
  if (!names.has("recent_listing_withdrawal_signal")) {
    database.exec(
      "ALTER TABLE leads ADD COLUMN recent_listing_withdrawal_signal INTEGER",
    );
  }
  if (!names.has("signals_json")) {
    database.exec("ALTER TABLE leads ADD COLUMN signals_json TEXT");
  }
}

/** Idempotent demo account: demo@dealflow.ai / demo1234. */
function seedDemoUser(database: Database): void {
  const existing = database
    .query("SELECT id FROM users WHERE email = ?")
    .get("demo@dealflow.ai");
  if (existing) return;
  const hash = Bun.password.hashSync("demo1234");
  database
    .query(
      "INSERT INTO users (name, email, company, password_hash) VALUES (?, ?, ?, ?)",
    )
    .run("Demo Investor", "demo@dealflow.ai", "Demo Co", hash);
}

/* ---------------------------------------------------------------------- */
/* Tagged-template helper                                                  */
/* ---------------------------------------------------------------------- */

function toSqlText(strings: TemplateStringsArray, params: unknown[]): string {
  let text = "";
  for (let i = 0; i < strings.length; i++) {
    text += strings[i] ?? "";
    if (i < params.length) text += "?";
  }
  return text;
}

export function sql(): SqlTag {
  const tag = (async (
    strings: TemplateStringsArray,
    ...params: SQLiteBindValue[]
  ) => {
    const database = await getDb();
    return database.query(toSqlText(strings, params)).all(...params);
  }) as unknown as SqlTag;

  tag.run = async (strings, ...params) => {
    const database = await getDb();
    return database.query(toSqlText(strings, params)).run(...params);
  };

  tag.insert = async (strings, ...params) => {
    const database = await getDb();
    return Number(
      database.query(toSqlText(strings, params)).run(...params).lastInsertRowid,
    );
  };

  return tag;
}