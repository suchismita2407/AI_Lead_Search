/**
 * DealFlow AI — investor workspace settings (SERVER-ONLY).
 *
 * One `user_settings` row per user: business identity, contact channels, and
 * the custom AI instructions the seller assistant follows. `saveSettings` is an
 * upsert (user_id is UNIQUE); `getSettings` returns the row or sensible
 * defaults so the form always renders.
 *
 * All reads/writes are scoped to the session user via requireUser. The one
 * exception is `getAiInstructionsForUser(userId)` — a plain DB read used by the
 * conversation layer (which has already authorized the user) so the seller
 * prompt can be personalized without a second session lookup.
 *
 * SERVER-ONLY: never statically imported by client-visible code — reached only
 * via the RPC definitions in `./settings.ts`, whose handlers dynamically import
 * this module. Static edges to this module also exist from `./ai.server.ts`
 * (inside the reply builder) — also server-only.
 */
import { sql } from "~/db";
import { requireUser } from "./auth.server";

/** Per-field max lengths from the owner spec (validated on save). */
export const SETTINGS_LIMITS = {
  business_name: 120,
  phone: 40,
  business_email: 120,
  calendar: 160,
  messaging: 160,
  ai_instructions: 2000,
} as const;

export type SettingsKey = keyof typeof SETTINGS_LIMITS;

export interface UserSettings {
  business_name: string;
  phone: string;
  business_email: string;
  calendar: string;
  messaging: string;
  ai_instructions: string;
}

const EMPTY_SETTINGS: UserSettings = {
  business_name: "",
  phone: "",
  business_email: "",
  calendar: "",
  messaging: "",
  ai_instructions: "",
};

export type SettingsInput = Partial<Record<SettingsKey, string>>;

function toSettings(row: Record<string, unknown> | undefined): UserSettings {
  if (!row) return { ...EMPTY_SETTINGS };
  const pick = (key: SettingsKey): string =>
    row[key] == null ? "" : String(row[key]).trim();
  return {
    business_name: pick("business_name"),
    phone: pick("phone"),
    business_email: pick("business_email"),
    calendar: pick("calendar"),
    messaging: pick("messaging"),
    ai_instructions: pick("ai_instructions"),
  };
}

/** The session user's settings — defaults (all empty) when none saved yet. */
export async function getSettingsForUser(): Promise<UserSettings> {
  const user = await requireUser();
  const rows = await sql()`
    SELECT business_name, phone, business_email, calendar, messaging, ai_instructions
    FROM user_settings
    WHERE user_id = ${user.id}
  `;
  return toSettings(rows[0] as Record<string, unknown> | undefined);
}

/** Plain per-user read of the stored AI instructions ("" when unset). */
export async function getAiInstructionsForUser(userId: number): Promise<string> {
  const rows = await sql()`
    SELECT ai_instructions FROM user_settings WHERE user_id = ${userId}
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row && row.ai_instructions != null
    ? String(row.ai_instructions).trim()
    : "";
}

/**
 * Validate + upsert the session user's settings. Values are trimmed; empty
 * strings are allowed (the field is simply not configured). Returns
 * { settings } on success or { error } when a field exceeds its max length.
 */
export async function saveSettingsForUser(
  input: SettingsInput,
): Promise<{ error: string } | { settings: UserSettings }> {
  const user = await requireUser();

  const cleaned: UserSettings = { ...EMPTY_SETTINGS };
  for (const key of Object.keys(SETTINGS_LIMITS) as SettingsKey[]) {
    const raw = input[key] == null ? "" : String(input[key]);
    const value = raw.trim();
    if (value.length > SETTINGS_LIMITS[key]) {
      return {
        error: `"${key.replace(/_/g, " ")}" is too long (max ${SETTINGS_LIMITS[key]} characters).`,
      };
    }
    cleaned[key] = value;
  }

  await sql().run`
    INSERT INTO user_settings (
      user_id, business_name, phone, business_email, calendar, messaging,
      ai_instructions, updated_at
    ) VALUES (
      ${user.id}, ${cleaned.business_name}, ${cleaned.phone},
      ${cleaned.business_email}, ${cleaned.calendar}, ${cleaned.messaging},
      ${cleaned.ai_instructions}, now()::text
    )
    ON CONFLICT(user_id) DO UPDATE SET
      business_name = excluded.business_name,
      phone = excluded.phone,
      business_email = excluded.business_email,
      calendar = excluded.calendar,
      messaging = excluded.messaging,
      ai_instructions = excluded.ai_instructions,
      updated_at = now()::text
  `;

  return { settings: cleaned };
}
