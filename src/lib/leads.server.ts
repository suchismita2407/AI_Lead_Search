/**
 * DealFlow AI — lead operations (SERVER-ONLY).
 *
 * CSV import (parse → dedupe → insert/update → score), lead listing and lead
 * detail. All queries are scoped to the session user. Never statically
 * imported by client-visible code — reached only via the RPC definitions in
 * `./leads.ts`, whose handlers dynamically import this module.
 */
import { sql } from "~/db";
import { requireUser } from "./auth.server";
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
    created_at: String(row.created_at ?? ""),
  };
}

/** All leads for the current user, newest first. */
export async function listLeadsForUser(): Promise<LeadListItem[]> {
  const user = await requireUser();
  const rows = await sql()`
    SELECT * FROM leads
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC, id DESC
  `;
  return rows.map(toLeadListItem);
}

/** Single lead for the current user, or null if not found / not theirs. */
export async function getLeadForUser(id: number): Promise<LeadDetail | null> {
  const user = await requireUser();
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
  const user = await requireUser();
  const { rows, skipped } = parseLeadsCsv(csvText);

  // Load the user's existing leads once, keyed for dedupe.
  const existing = await sql()`
    SELECT * FROM leads WHERE user_id = ${user.id}
  `;
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