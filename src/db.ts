/** PostgreSQL data layer. Requires DATABASE_URL (Neon/Supabase pooled URL). */
import { Pool, type QueryResultRow } from "pg";

export type SqlRow = Record<string, unknown>;
export interface SqlResult { changes: number; lastInsertRowid: number; }
export interface SqlTag {
  (strings: TemplateStringsArray, ...params: unknown[]): Promise<SqlRow[]>;
  run(strings: TemplateStringsArray, ...params: unknown[]): Promise<SqlResult>;
  insert(strings: TemplateStringsArray, ...params: unknown[]): Promise<number>;
}

declare global { var __dealflowPool: Pool | undefined; var __dealflowSchemaReady: Promise<void> | undefined; }

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Configure a pooled Neon or Supabase Postgres URL.");
  return (globalThis.__dealflowPool ??= new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined, max: 5 }));
}

function compile(strings: TemplateStringsArray, values: unknown[]) {
  return { text: strings.reduce((out, part, i) => out + part + (i < values.length ? `$${i + 1}` : ""), ""), values };
}

const migration = `
CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, company TEXT, password_hash TEXT NOT NULL, email_verified_at TEXT, created_at TEXT NOT NULL DEFAULT now()::text);
CREATE TABLE IF NOT EXISTS sessions (id BIGSERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT now()::text, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE TABLE IF NOT EXISTS auth_tokens (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')), token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL DEFAULT now()::text);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_lookup ON auth_tokens(token_hash, purpose);
CREATE TABLE IF NOT EXISTS rate_limit_events (id BIGSERIAL PRIMARY KEY, scope TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT now()::text);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_scope ON rate_limit_events(scope, created_at);
CREATE TABLE IF NOT EXISTS subscriptions (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, provider_subscription_id TEXT UNIQUE, plan TEXT NOT NULL DEFAULT 'free', status TEXT NOT NULL DEFAULT 'inactive', current_period_end TEXT, created_at TEXT NOT NULL DEFAULT now()::text, updated_at TEXT NOT NULL DEFAULT now()::text);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_started_at TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TEXT;
CREATE TABLE IF NOT EXISTS billing_events (id BIGSERIAL PRIMARY KEY, provider TEXT NOT NULL, event_id TEXT NOT NULL, payload JSONB NOT NULL, created_at TEXT NOT NULL DEFAULT now()::text, UNIQUE(provider,event_id));
CREATE TABLE IF NOT EXISTS leads (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, owner_name TEXT, property_address TEXT, city TEXT, state TEXT, zip TEXT, property_type TEXT, estimated_value DOUBLE PRECISION, estimated_equity DOUBLE PRECISION, lead_score INTEGER, status TEXT, ownership_duration_years DOUBLE PRECISION, vacancy_signal INTEGER, needs_work_signal INTEGER, distress_signal INTEGER, absentee_owner_signal INTEGER, recent_listing_withdrawal_signal INTEGER, signals_json TEXT, flagged_hot INTEGER DEFAULT 0, notes TEXT, archived INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT now()::text);
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE TABLE IF NOT EXISTS conversations (id BIGSERIAL PRIMARY KEY, lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE, channel TEXT, sender TEXT, message TEXT, timestamp TEXT NOT NULL DEFAULT now()::text);
CREATE TABLE IF NOT EXISTS qualification (lead_id BIGINT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE, motivation INTEGER NOT NULL DEFAULT 0 CHECK (motivation BETWEEN 0 AND 5), timeline INTEGER NOT NULL DEFAULT 0 CHECK (timeline BETWEEN 0 AND 5), condition INTEGER NOT NULL DEFAULT 0 CHECK (condition BETWEEN 0 AND 5), price_flexibility INTEGER NOT NULL DEFAULT 0 CHECK (price_flexibility BETWEEN 0 AND 5), contactability INTEGER NOT NULL DEFAULT 0 CHECK (contactability BETWEEN 0 AND 5), total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 25), summary TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS appointments (id BIGSERIAL PRIMARY KEY, lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE, date TEXT, time TEXT, status TEXT, created_at TEXT NOT NULL DEFAULT now()::text);
CREATE TABLE IF NOT EXISTS deals (id BIGSERIAL PRIMARY KEY, lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE, purchase_price DOUBLE PRECISION, rehab DOUBLE PRECISION, arv DOUBLE PRECISION, closing_costs DOUBLE PRECISION, holding_costs DOUBLE PRECISION, selling_costs DOUBLE PRECISION, estimated_profit DOUBLE PRECISION, roi DOUBLE PRECISION, created_at TEXT NOT NULL DEFAULT now()::text);
CREATE TABLE IF NOT EXISTS user_settings (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, business_name TEXT, phone TEXT, business_email TEXT, calendar TEXT, messaging TEXT, ai_instructions TEXT, updated_at TEXT NOT NULL DEFAULT now()::text);
`;

async function ensureSchema(): Promise<void> { globalThis.__dealflowSchemaReady ??= pool().query(migration).then(() => undefined); return globalThis.__dealflowSchemaReady; }
async function query(strings: TemplateStringsArray, params: unknown[]): Promise<QueryResultRow[]> { await ensureSchema(); const q = compile(strings, params); return (await pool().query(q.text, q.values)).rows; }

export function sql(): SqlTag {
  const tag = ((strings: TemplateStringsArray, ...params: unknown[]) => query(strings, params)) as SqlTag;
  tag.run = async (strings, ...params) => { await ensureSchema(); const q = compile(strings, params); const result = await pool().query(q.text, q.values); return { changes: result.rowCount ?? 0, lastInsertRowid: 0 }; };
  tag.insert = async (strings, ...params) => { await ensureSchema(); const q = compile(strings, params); const rows = (await pool().query(`${q.text} RETURNING id`, q.values)).rows; return Number(rows[0]?.id ?? 0); };
  return tag;
}
