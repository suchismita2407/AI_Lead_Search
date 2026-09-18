/**
 * DealFlow AI — lead operations (SERVER-ONLY).
 *
 * CSV import (parse → dedupe → insert/update → score), lead listing and lead
 * detail. All queries are scoped to the session user. Never statically
 * imported by client-visible code — reached only via the RPC definitions in
 * `./leads.ts`, whose handlers dynamically import this module.
 */
import { sql } from "~/db";
import { getWorkspaceAccessForUser, requireWorkspaceAccess } from "./auth.server";
import { parseLeadsCsv } from "./csv.server";
import {
  computeSignals,
  type ScoringResult,
} from "./scoring.server";
import { scoreToBand, type LeadBand, type SignalBreakdownItem } from "./scoring";
import {
  getConversationSnapshot,
  getAppointmentForLead,
  type ConversationSnapshot,
  type AppointmentSnapshot,
} from "./conversations.server";
import {
  getQualificationForLead,
  type QualificationRecord,
} from "./qualification.server";

export interface LeadListItem {
  id: number;
  owner_name: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  estimated_value: number | null;
  estimated_equity: number | null;
  lead_score: number | null;
  band: LeadBand | null;
  status: string | null;
  /** Investor flag: 1 when the lead is marked HOT from the detail page. */
  flagged_hot: boolean;
  /** Investor free-text note (leads.notes), "" when none. */
  notes: string;
  /** 1 when the lead is archived (hidden from the default list). */
  archived: boolean;
  created_at: string;
}

export interface LeadDetail extends LeadListItem {
  signals: SignalBreakdownItem[];
  /** AI seller conversation thread + whether replies are simulated. */
  conversation: ConversationSnapshot;
  /** Seller qualification from the conversation, once it exists. */
  qualification: QualificationRecord | null;
  /** Booked call, once the investor schedules one. */
  appointment: AppointmentSnapshot | null;
}

export interface ImportLeadsResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  bands: Record<LeadBand, number>;
}

function toLeadListItem(row: Record<string, unknown>): LeadListItem {
  const score = row.lead_score == null ? null : Number(row.lead_score);
  return {
    id: Number(row.id),
    owner_name: row.owner_name == null ? null : String(row.owner_name),
    property_address:
      row.property_address == null ? null : String(row.property_address),
    city: row.city == null ? null : String(row.city),
    state: row.state == null ? null : String(row.state),
    zip: row.zip == null ? null : String(row.zip),
    property_type:
      row.property_type == null ? null : String(row.property_type),
    estimated_value:
      row.estimated_value == null ? null : Number(row.estimated_value),
    estimated_equity:
      row.estimated_equity == null ? null : Number(row.estimated_equity),
    lead_score: score,
    band: scoreToBand(score),
    status: row.status == null ? null : String(row.status),
    flagged_hot: Number(row.flagged_hot ?? 0) === 1,
    notes: row.notes == null ? "" : String(row.notes),
    archived: Number(row.archived ?? 0) === 1,
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * All NON-ARCHIVED leads for the current user, newest first. Archive is a list
 * filter, not a delete — archived leads are still reachable by id (detail page,
 * conversation, booking) and via the Archived tab on this page.
 */
export async function listLeadsForUser(): Promise<LeadListItem[]> {
  const user = await requireWorkspaceAccess();
  const rows = await sql()`
    SELECT * FROM leads
    WHERE user_id = ${user.id} AND archived <> 1
    ORDER BY created_at DESC, id DESC
  `;
  return rows.map(toLeadListItem);
}

/** Only archived leads for the current user (the Archived list tab). */
export async function listArchivedLeadsForUser(): Promise<LeadListItem[]> {
  const user = await requireWorkspaceAccess();
  const rows = await sql()`
    SELECT * FROM leads
    WHERE user_id = ${user.id} AND archived = 1
    ORDER BY created_at DESC, id DESC
  `;
  return rows.map(toLeadListItem);
}

/** Single lead for the current user, or null if not found / not theirs. */
export async function getLeadForUser(id: number): Promise<LeadDetail | null> {
  const user = await requireWorkspaceAccess();
  const rows = await sql()`
    SELECT * FROM leads
    WHERE id = ${id} AND user_id = ${user.id}
  `;
  const row = rows[0];
  if (!row) return null;

  let signals: SignalBreakdownItem[] = [];
  const rawJson = row.signals_json == null ? null : String(row.signals_json);
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) signals = parsed as SignalBreakdownItem[];
    } catch {
      signals = [];
    }
  }
  const [conversation, qualification, appointment] = await Promise.all([
    getConversationSnapshot(Number(row.id), user.id),
    getQualificationForLead(Number(row.id), user.id),
    getAppointmentForLead(Number(row.id), user.id),
  ]);
  return {
    ...toLeadListItem(row),
    signals,
    conversation,
    qualification,
    appointment,
  };
}

const normKey = (s: string | null): string =>
  (s ?? "").trim().toLowerCase();

/**
 * Import a leads CSV for the current user.
 *
 * Dedupe by property_address per user (address present) or owner_name
 * (address absent) — re-uploading the same file updates existing rows rather
 * than inserting duplicates. Only the CSV-driven fields are written on
 * update; `status` and `created_at` are left alone. Every lead's score and
 * signal breakdown are recomputed on each import.
 */
export async function importLeadsCsvData(
  csvText: string,
): Promise<ImportLeadsResult> {
  const user = await requireWorkspaceAccess();
  const parsed = parseLeadsCsv(csvText);
  const rows = parsed.rows;
  let skipped = parsed.skipped;

  // Load the user's existing leads once, keyed for dedupe.
  const existing = await sql()`
    SELECT * FROM leads WHERE user_id = ${user.id}
  `;
  const access = await getWorkspaceAccessForUser(user);
  const byKey = new Map<string, Record<string, unknown>>();
  for (const lead of existing) {
    const address = lead.property_address == null ? null : String(lead.property_address);
    const owner = lead.owner_name == null ? null : String(lead.owner_name);
    const key = address
      ? `a:${normKey(address)}`
      : `o:${normKey(owner ?? "")}`;
    if (!byKey.has(key)) byKey.set(key, lead);
  }

  const bands: Record<LeadBand, number> = { HOT: 0, WARM: 0, NURTURE: 0, LOW: 0 };
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const scored: ScoringResult = computeSignals(row);
    bands[scored.band] += 1;
    const signalsJson = JSON.stringify(scored.signals);

    const address = row.property_address;
    const owner = row.owner_name;
    const key = address ? `a:${normKey(address)}` : `o:${normKey(owner ?? "")}`;
    const existingLead = byKey.get(key);
    if (!existingLead && access.leadLimit !== null && existing.length + inserted >= access.leadLimit) {
      skipped += 1;
      continue;
    }

    if (existingLead) {
      await sql().run`
        UPDATE leads SET
          owner_name = ${owner},
          property_address = ${address},
          city = ${row.city},
          state = ${row.state},
          zip = ${row.zip},
          property_type = ${row.property_type},
          estimated_value = ${row.estimated_value},
          estimated_equity = ${row.estimated_equity},
          ownership_duration_years = ${row.ownership_duration_years},
          vacancy_signal = ${row.vacancy_signal},
          needs_work_signal = ${row.needs_work_signal},
          distress_signal = ${row.distress_signal},
          absentee_owner_signal = ${row.absentee_owner_signal},
          recent_listing_withdrawal_signal = ${row.recent_listing_withdrawal_signal},
          lead_score = ${scored.score},
          signals_json = ${signalsJson}
        WHERE id = ${Number(existingLead.id)}
      `;
      updated += 1;
    } else {
      await sql().insert`
        INSERT INTO leads (
          user_id, owner_name, property_address, city, state, zip,
          property_type, estimated_value, estimated_equity,
          ownership_duration_years, vacancy_signal, needs_work_signal,
          distress_signal, absentee_owner_signal,
          recent_listing_withdrawal_signal, lead_score, signals_json, status
        ) VALUES (
          ${user.id}, ${owner}, ${address}, ${row.city}, ${row.state}, ${row.zip},
          ${row.property_type}, ${row.estimated_value}, ${row.estimated_equity},
          ${row.ownership_duration_years}, ${row.vacancy_signal}, ${row.needs_work_signal},
          ${row.distress_signal}, ${row.absentee_owner_signal},
          ${row.recent_listing_withdrawal_signal}, ${scored.score}, ${signalsJson}, 'new'
        )
      `;
      inserted += 1;
    }
  }

  return {
    total: rows.length,
    inserted,
    updated,
    skipped,
    bands,
  };
}

/* ---------------------------------------------------------------------- */
/* Lead actions (milestone 5): MARK HOT / ADD NOTE / ARCHIVE               */
/* ---------------------------------------------------------------------- */

export const MAX_LEAD_NOTE_LENGTH = 2000;

/** Scoped ownership check — every action below verifies the lead is the user's. */
async function ownedLead(leadId: number, userId: number): Promise<boolean> {
  const rows = await sql()`
    SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}

/**
 * MARK HOT / UNMARK HOT — sets leads.flagged_hot (independent of the score
 * band, which stays the screening-signal read). Returns the new state, or null
 * when the lead isn't the user's.
 */
export async function setLeadHotForUser(
  leadId: number,
  hot: boolean,
): Promise<{ flagged_hot: boolean } | null> {
  const user = await requireWorkspaceAccess();
  if (!(await ownedLead(leadId, user.id))) return null;
  await sql().run`
    UPDATE leads SET flagged_hot = ${hot ? 1 : 0}
    WHERE id = ${leadId} AND user_id = ${user.id}
  `;
  return { flagged_hot: hot };
}

/**
 * ADD NOTE / EDIT NOTE — stores the investor's free-text note on the lead
 * ("" clears it). Trimmed; capped at MAX_LEAD_NOTE_LENGTH.
 */
export async function setLeadNoteForUser(
  leadId: number,
  rawNote: string,
): Promise<{ error: string } | { note: string } | null> {
  const user = await requireWorkspaceAccess();
  if (!(await ownedLead(leadId, user.id))) return null;
  const note = String(rawNote ?? "").trim();
  if (note.length > MAX_LEAD_NOTE_LENGTH) {
    return {
      error: `Note is too long (max ${MAX_LEAD_NOTE_LENGTH} characters).`,
    };
  }
  await sql().run`
    UPDATE leads SET notes = ${note}
    WHERE id = ${leadId} AND user_id = ${user.id}
  `;
  return { note };
}

/**
 * ARCHIVE / RESTORE — sets leads.archived. Archive hides the lead from the
 * default list only: the detail page, conversation, qualification and booking
 * all keep working on archived leads.
 */
export async function setLeadArchivedForUser(
  leadId: number,
  archived: boolean,
): Promise<{ archived: boolean } | null> {
  const user = await requireWorkspaceAccess();
  if (!(await ownedLead(leadId, user.id))) return null;
  await sql().run`
    UPDATE leads SET archived = ${archived ? 1 : 0}
    WHERE id = ${leadId} AND user_id = ${user.id}
  `;
  return { archived };
}

export type CreateLeadInput = {
  ownerName?: string; address: string; city: string; state: string; zip?: string;
  propertyType?: string; estimatedValue?: number | null; estimatedEquity?: number | null;
  ownershipYears?: number | null; vacancy?: boolean; needsWork?: boolean;
  distress?: boolean; absenteeOwner?: boolean; listingWithdrawal?: boolean;
};

const trimField = (value: unknown, max: number): string | null => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

const safeAmount = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Create one user-supplied lead. Signals are investor hypotheses, not web claims. */
export async function createLeadForUser(input: CreateLeadInput): Promise<{ lead: LeadListItem } | { error: string }> {
  const user = await requireWorkspaceAccess();
  const address = trimField(input.address, 300);
  const city = trimField(input.city, 100);
  const state = trimField(input.state, 80);
  if (!address || !city || !state) return { error: "Property address, city, and state are required." };
  const owner = trimField(input.ownerName, 200);
  const existing = await sql()`SELECT id FROM leads WHERE user_id = ${user.id} AND lower(property_address) = lower(${address}) LIMIT 1`;
  if (existing[0]) return { error: "A lead with this property address already exists." };
  const access = await getWorkspaceAccessForUser(user);
  if (access.leadLimit !== null) {
    const [count] = await sql()`SELECT COUNT(*) AS total FROM leads WHERE user_id = ${user.id}`;
    if (Number(count?.total ?? 0) >= access.leadLimit) return { error: `Your 3-day trial includes up to ${access.leadLimit} leads. Upgrade to add more.` };
  }
  const scoreInput = {
    ownership_duration_years: safeAmount(input.ownershipYears), estimated_value: safeAmount(input.estimatedValue), estimated_equity: safeAmount(input.estimatedEquity),
    vacancy_signal: input.vacancy ? 1 : 0, needs_work_signal: input.needsWork ? 1 : 0,
    distress_signal: input.distress ? 1 : 0, absentee_owner_signal: input.absenteeOwner ? 1 : 0,
    recent_listing_withdrawal_signal: input.listingWithdrawal ? 1 : 0,
  } as const;
  const scored = computeSignals(scoreInput);
  const id = await sql().insert`
    INSERT INTO leads (user_id, owner_name, property_address, city, state, zip, property_type, estimated_value, estimated_equity, ownership_duration_years, vacancy_signal, needs_work_signal, distress_signal, absentee_owner_signal, recent_listing_withdrawal_signal, lead_score, signals_json, status)
    VALUES (${user.id}, ${owner}, ${address}, ${city}, ${state}, ${trimField(input.zip, 20)}, ${trimField(input.propertyType, 100)}, ${scoreInput.estimated_value}, ${scoreInput.estimated_equity}, ${scoreInput.ownership_duration_years}, ${scoreInput.vacancy_signal}, ${scoreInput.needs_work_signal}, ${scoreInput.distress_signal}, ${scoreInput.absentee_owner_signal}, ${scoreInput.recent_listing_withdrawal_signal}, ${scored.score}, ${JSON.stringify(scored.signals)}, 'new')
  `;
  const [row] = await sql()`SELECT * FROM leads WHERE id = ${id} AND user_id = ${user.id}`;
  return row ? { lead: toLeadListItem(row) } : { error: "Could not save this lead. Try again." };
}
