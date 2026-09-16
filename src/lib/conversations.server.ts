/**
 * DealFlow AI — seller conversation operations (SERVER-ONLY).
 *
 * startConversation / sendSellerMessage / bookAppointment drive the AI seller
 * conversation: thread storage, AI reply generation (real or simulated), and
 * qualification recomputation. Every operation verifies the lead belongs to
 * the session user before touching anything — all data stays user-scoped.
 *
 * SERVER-ONLY: never statically imported by client-visible code — reached only
 * via the RPC definitions in `./conversations.ts`, whose handlers dynamically
 * import this module.
 */
import { sql } from "~/db";
import { requireUser } from "./auth.server";
import {
  buildAiReply,
  buildOpeningMessage,
  isSimulatedMode,
} from "./ai.server";
import {
  qualifyConversation,
  type QualificationRecord,
} from "./qualification.server";

export interface ConversationMessage {
  id: number;
  lead_id: number;
  channel: string | null;
  sender: "seller" | "ai";
  message: string;
  timestamp: string;
}

export interface ConversationSnapshot {
  messages: ConversationMessage[];
  /** True when AI replies are simulated (no OPENAI_API_KEY configured). */
  simulated: boolean;
}

export interface LeadStatusSummary {
  id: number;
  status: string | null;
}

export interface AppointmentSnapshot {
  id: number;
  date: string | null;
  time: string | null;
  status: string | null;
}

export const MAX_MESSAGE_LENGTH = 2000;

/* --------------------------- read helpers --------------------------- */

function toMessage(row: Record<string, unknown>): ConversationMessage {
  return {
    id: Number(row.id),
    lead_id: Number(row.lead_id),
    channel: row.channel == null ? null : String(row.channel),
    sender: String(row.sender) === "ai" ? "ai" : "seller",
    message: String(row.message ?? ""),
    timestamp: String(row.timestamp ?? ""),
  };
}

/** Full thread for a lead the user owns, oldest first. */
export async function getConversationForLead(
  leadId: number,
  userId: number,
): Promise<ConversationMessage[]> {
  const rows = await sql()`
    SELECT * FROM conversations
    WHERE lead_id = ${leadId}
      AND lead_id IN (SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${userId})
    ORDER BY id ASC
  `;
  return rows.map(toMessage);
}

export async function getConversationSnapshot(
  leadId: number,
  userId: number,
): Promise<ConversationSnapshot> {
  return {
    messages: await getConversationForLead(leadId, userId),
    simulated: isSimulatedMode(),
  };
}

export async function getAppointmentForLead(
  leadId: number,
  userId: number,
): Promise<AppointmentSnapshot | null> {
  const row = (await sql()`
    SELECT * FROM appointments
    WHERE lead_id = ${leadId}
      AND lead_id IN (SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${userId})
    ORDER BY id DESC LIMIT 1
  `)[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    date: row.date == null ? null : String(row.date),
    time: row.time == null ? null : String(row.time),
    status: row.status == null ? null : String(row.status),
  };
}

async function leadStatus(leadId: number, userId: number): Promise<string | null> {
  const row = (await sql()`
    SELECT status FROM leads WHERE id = ${leadId} AND user_id = ${userId}
  `)[0] as Record<string, unknown> | undefined;
  return row ? (row.status == null ? null : String(row.status)) : null;
}

/* --------------------------- startConversation --------------------------- */

/**
 * If the lead has no messages yet, insert the persona's opening qualifying
 * question and set the lead status to 'contacted'. Idempotent: calling it
 * again on a thread that already exists is a no-op. Returns null when the
 * lead isn't the user's.
 */
export async function startConversationForLead(leadId: number): Promise<
  | { error: string }
  | { messages: ConversationMessage[]; simulated: boolean; method: "started" | "exists" }
  | null
> {
  const user = await requireUser();
  const lead = (await sql()`
    SELECT owner_name, city, state FROM leads
    WHERE id = ${leadId} AND user_id = ${user.id}
  `)[0] as Record<string, unknown> | undefined;
  if (!lead) return null;

  const existing = await sql()`
    SELECT COUNT(*) AS c FROM conversations WHERE lead_id = ${leadId}
  `;
  if (Number(existing[0].c) === 0) {
    const opening = buildOpeningMessage({
      owner_name: lead.owner_name == null ? null : String(lead.owner_name),
      city: lead.city == null ? null : String(lead.city),
      state: lead.state == null ? null : String(lead.state),
    }).slice(0, MAX_MESSAGE_LENGTH);
    const channel = isSimulatedMode() ? "simulated" : "ai";
    await sql().insert`
      INSERT INTO conversations (lead_id, channel, sender, message)
      VALUES (${leadId}, ${channel}, 'ai', ${opening})
    `;
    await sql().run`
      UPDATE leads SET status = 'contacted'
      WHERE id = ${leadId} AND user_id = ${user.id} AND status = 'new'
    `;
  }

  const messages = await getConversationForLead(leadId, user.id);
  return {
    messages,
    simulated: isSimulatedMode(),
    method: Number(existing[0].c) === 0 ? "started" : "exists",
  };
}

/* --------------------------- sendSellerMessage --------------------------- */

/**
 * Appends the seller's message, generates the AI reply from the full thread
 * (real OpenAI call, or the script when no key is set), appends it, recomputes
 * the seller qualification, and returns the new thread + qualification + lead
 * status. Returns null when the lead isn't the user's; { error } for invalid
 * input.
 */
export async function sendSellerMessageForLead(
  leadId: number,
  rawText: string,
): Promise<
  | { error: string }
  | {
      messages: ConversationMessage[];
      qualification: QualificationRecord | null;
      lead: LeadStatusSummary;
      simulated: boolean;
    }
  | null
> {
  const user = await requireUser();
  const text = String(rawText ?? "").trim();
  if (!text) return { error: "Message can't be empty." };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  const lead = (await sql()`
    SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${user.id}
  `)[0];
  if (!lead) return null;

  const channel = isSimulatedMode() ? "simulated" : "ai";
  await sql().insert`
    INSERT INTO conversations (lead_id, channel, sender, message)
    VALUES (${leadId}, ${channel}, 'seller', ${text})
  `;

  // Generate + store the assistant's reply from the updated thread. Pass the
  // user id so the system prompt can include their saved AI instructions.
  const history = await getConversationForLead(leadId, user.id);
  const reply = await buildAiReply(history, { userId: user.id });
  await sql().insert`
    INSERT INTO conversations (lead_id, channel, sender, message)
    VALUES (${leadId}, ${channel}, 'ai', ${reply.slice(0, MAX_MESSAGE_LENGTH)})
  `;

  const messages = await getConversationForLead(leadId, user.id);
  const qualification = await qualifyConversation(leadId, user.id, messages);
  const status = await leadStatus(leadId, user.id);

  return {
    messages,
    qualification,
    lead: { id: leadId, status },
    simulated: isSimulatedMode(),
  };
}

/* --------------------------- bookAppointment --------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/**
 * The investor's action (never autonomous): record a scheduled appointment for
 * the lead and set the lead status to 'booked'. Idempotent — re-booking
 * returns the existing appointment. Returns null when the lead isn't the
 * user's; { error } for invalid date/time.
 */
export async function bookAppointmentForLead(
  leadId: number,
  dateStr: string,
  timeStr: string,
): Promise<
  | { error: string }
  | { appointment: AppointmentSnapshot; lead: LeadStatusSummary }
  | null
> {
  const user = await requireUser();
  const date = String(dateStr ?? "").trim();
  const time = String(timeStr ?? "").trim();
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    return { error: "Please pick a valid date and time." };
  }

  const lead = (await sql()`
    SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${user.id}
  `)[0];
  if (!lead) return null;

  const existing = await getAppointmentForLead(leadId, user.id);
  if (existing) {
    await sql().run`
      UPDATE appointments SET date = ${date}, time = ${time}, status = 'scheduled'
      WHERE id = ${existing.id}
    `;
    await sql().run`
      UPDATE leads SET status = 'booked' WHERE id = ${leadId} AND user_id = ${user.id}
    `;
    const updated = await getAppointmentForLead(leadId, user.id);
    return {
      appointment: updated ?? existing,
      lead: { id: leadId, status: "booked" },
    };
  }

  await sql().insert`
    INSERT INTO appointments (lead_id, date, time, status)
    VALUES (${leadId}, ${date}, ${time}, 'scheduled')
  `;
  await sql().run`
    UPDATE leads SET status = 'booked' WHERE id = ${leadId} AND user_id = ${user.id}
  `;
  const appointment = await getAppointmentForLead(leadId, user.id);
  return {
    appointment: appointment ?? { id: 0, date, time, status: "scheduled" },
    lead: { id: leadId, status: "booked" },
  };
}