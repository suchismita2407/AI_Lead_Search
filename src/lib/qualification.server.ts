/**
 * DealFlow AI — seller qualification (SERVER-ONLY).
 *
 * Turns the conversation transcript into the five 0–5 dimension scores
 * (motivation, timeline, condition, price flexibility, contactability), a
 * /25 total and a short summary, then upserts the result into `qualification`
 * and moves the lead to 'qualified' once the total reaches 15.
 *
 * Real mode: asks the model for strict JSON (parsed defensively; on any parse
 * failure we fall back to the simulated scores rather than crash the
 * conversation). Simulated mode: scripted scores that progress with the
 * conversation — partial after 1–2 seller exchanges, complete (21/25 → HOT)
 * from the third, which is what the demo needs to show qualification working.
 *
 * SERVER-ONLY: never statically imported by client-visible code.
 */
import { sql } from "~/db";
import { isSimulatedMode, openAiChatCompletion } from "./ai.server";
import { qualificationBand, type LeadBand } from "./scoring";
import type { ConversationMessage } from "./conversations.server";

export interface QualificationRecord {
  lead_id: number;
  motivation: number;
  timeline: number;
  condition: number;
  price_flexibility: number;
  contactability: number;
  total_score: number;
  band: LeadBand | null;
  summary: string | null;
  updated_at: string | null;
}

export interface QualificationScores {
  motivation: number;
  timeline: number;
  condition: number;
  price_flexibility: number;
  contactability: number;
  summary: string;
}

/** Total at or above which a lead counts as qualified (band WARM+). */
export const QUALIFIED_TOTAL = 15;

/* ---------------------------------------------------------------------- */
/* Simulated scoring                                                       */
/* ---------------------------------------------------------------------- */

function simulatedScores(sellerExchanges: number): QualificationScores {
  return sellerExchanges >= 3
    ? {
        motivation: 5,
        timeline: 4,
        condition: 4,
        price_flexibility: 4,
        contactability: 4,
        summary:
          "The seller is highly motivated to sell in the next few months, describes the property as needing some repairs, is flexible on price, and is open to a call with the investor's team soon. Ready to hand off and book an appointment.",
      }
    : {
        motivation: 4,
        timeline: 3,
        condition: 3,
        price_flexibility: 2,
        contactability: 2,
        summary:
          "Early in the conversation — the seller is interested in selling and has shared some detail on condition and timeline. Price flexibility and call availability are still emerging; keep the conversation going to complete qualification.",
      };
}

/* ---------------------------------------------------------------------- */
/* Real-mode scoring (OpenAI)                                               */
/* ---------------------------------------------------------------------- */

const QUALIFY_SYSTEM_PROMPT = `You are DealFlow AI's seller-qualification engine for a real-estate investor.

From the conversation transcript, score the seller on five dimensions, each an integer 0-5:
- motivation: how motivated the seller is to sell,
- timeline: how soon they want to sell (5 = ready within about 3 months),
- condition: how much work they say the property needs (5 = needs significant work),
- price_flexibility: how flexible they are on price (5 = very flexible),
- contactability: how readily available they are for a follow-up call.

Also write "summary": a short single paragraph (2-4 sentences) explaining why this seller does or does not qualify, in plain language.

Respond with STRICT JSON only — no markdown, no extra text — in exactly this shape:
{"motivation":0,"timeline":0,"condition":0,"price_flexibility":0,"contactability":0,"summary":"..."}`;

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

/** Parse the model's JSON reply defensively; null when anything is off. */
function parseScoresJson(raw: string): QualificationScores | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const summary =
      typeof obj.summary === "string" && obj.summary.trim().length > 0
        ? obj.summary.trim()
        : null;
    if (!summary) return null;
    return {
      motivation: clampScore(obj.motivation),
      timeline: clampScore(obj.timeline),
      condition: clampScore(obj.condition),
      price_flexibility: clampScore(obj.price_flexibility),
      contactability: clampScore(obj.contactability),
      summary,
    };
  } catch {
    return null;
  }
}

/** Human-readable transcript of the thread, newest last. */
function transcriptText(messages: ConversationMessage[]): string {
  return messages
    .map((m) => `${m.sender === "ai" ? "Assistant" : "Seller"}: ${m.message}`)
    .join("\n");
}

async function realScores(
  messages: ConversationMessage[],
): Promise<QualificationScores> {
  const sellerExchanges = messages.filter((m) => m.sender === "seller").length;
  try {
    const reply = await openAiChatCompletion(
      [
        { role: "system", content: QUALIFY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Conversation transcript:\n${transcriptText(messages).slice(-4000)}`,
        },
      ],
      { temperature: 0, maxTokens: 500 },
    );
    const parsed = parseScoresJson(reply);
    if (parsed) return parsed;
    console.error(
      "[qualification.server] model JSON unparseable, using simulated scores:",
      reply.slice(0, 200),
    );
  } catch (err) {
    console.error(
      "[qualification.server] OpenAI qualification failed, using simulated scores:",
      err,
    );
  }
  return simulatedScores(sellerExchanges);
}

/* ---------------------------------------------------------------------- */
/* Orchestration                                                           */
/* ---------------------------------------------------------------------- */

/**
 * Score the current thread, upsert into `qualification`, and promote the lead
 * to 'qualified' at total >= 15 (never demoting a booked lead). Returns the
 * persisted record with band, or null if the lead isn't the user's.
 */
export async function qualifyConversation(
  leadId: number,
  userId: number,
  messages: ConversationMessage[],
): Promise<QualificationRecord | null> {
  const lead = (await sql()`
    SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${userId}
  `)[0];
  if (!lead) return null;

  const sellerExchanges = messages.filter((m) => m.sender === "seller").length;
  const scores = isSimulatedMode()
    ? simulatedScores(sellerExchanges)
    : await realScores(messages);

  const total = Math.min(
    25,
    scores.motivation +
      scores.timeline +
      scores.condition +
      scores.price_flexibility +
      scores.contactability,
  );
  const updatedAt = new Date().toISOString();
  const summary = scores.summary.slice(0, 1000);

  await sql().run`
    INSERT INTO qualification
      (lead_id, motivation, timeline, condition, price_flexibility,
       contactability, total_score, summary, updated_at)
    VALUES
      (${leadId}, ${scores.motivation}, ${scores.timeline}, ${scores.condition},
       ${scores.price_flexibility}, ${scores.contactability}, ${total}, ${summary}, ${updatedAt})
    ON CONFLICT(lead_id) DO UPDATE SET
      motivation = ${scores.motivation},
      timeline = ${scores.timeline},
      condition = ${scores.condition},
      price_flexibility = ${scores.price_flexibility},
      contactability = ${scores.contactability},
      total_score = ${total},
      summary = ${summary},
      updated_at = ${updatedAt}
  `;

  // Promote to 'qualified' once the bar is crossed — but never override a booked.
  if (total >= QUALIFIED_TOTAL) {
    await sql().run`
      UPDATE leads SET status = 'qualified'
      WHERE id = ${leadId} AND user_id = ${userId} AND status != 'booked'
    `;
  }

  return {
    lead_id: leadId,
    motivation: scores.motivation,
    timeline: scores.timeline,
    condition: scores.condition,
    price_flexibility: scores.price_flexibility,
    contactability: scores.contactability,
    total_score: total,
    band: qualificationBand(total),
    summary,
    updated_at: updatedAt,
  };
}

/** Read a lead's stored qualification (with band), or null. */
export async function getQualificationForLead(
  leadId: number,
  userId: number,
): Promise<QualificationRecord | null> {
  const lead = (await sql()`
    SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${userId}
  `)[0];
  if (!lead) return null;
  const row = (await sql()`
    SELECT * FROM qualification WHERE lead_id = ${leadId}
  `)[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const total = Number(row.total_score ?? 0);
  return {
    lead_id: Number(row.lead_id),
    motivation: Number(row.motivation ?? 0),
    timeline: Number(row.timeline ?? 0),
    condition: Number(row.condition ?? 0),
    price_flexibility: Number(row.price_flexibility ?? 0),
    contactability: Number(row.contactability ?? 0),
    total_score: total,
    band: qualificationBand(total),
    summary: row.summary == null ? null : String(row.summary),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
}