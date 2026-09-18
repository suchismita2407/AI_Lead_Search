/**
 * DealFlow AI — AI seller-conversation layer (SERVER-ONLY).
 *
 * Two modes:
 *  - REAL: opens a chat completion against the OpenAI API using plain fetch()
 *    (no client package needed). Enabled when OPENAI_API_KEY is set; the model
 *    comes from AI_MODEL or defaults to gpt-4o-mini.
 *  - SIMULATED: deterministic scripted replies, so the whole pipeline works
 *    end-to-end with no API key (per the product plan, the MVP first proves the
 *    flow with simulated seller conversations). No key set → automatic.
 *
 * CRITICAL CONSTRAINTS for the real assistant (also mirrored in the simulated
 * script): it never makes an offer, never states a purchase price, never books
 * an appointment on its own, and never invents property facts. The investor's
 * team makes all offers and bookings; the assistant only qualifies gently.
 *
 * SERVER-ONLY: never statically imported by client-visible code — reached only
 * via dynamic `await import()` inside server-fn handlers.
 */
import type { ConversationMessage } from "./conversations.server";

export type ChatRole = "system" | "assistant" | "user";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Persona + safety constraints for the seller assistant (both modes). */
export const SELLER_ASSISTANT_SYSTEM_PROMPT = `You are DealFlow AI's seller assistant, working for a real-estate investor who buys residential properties directly from owners.

Your job is to have a short, friendly, human conversation with a property owner and gently qualify them. Ask about, one question at a time:
- the property's condition,
- the owner's timeline for selling,
- the reason they are selling,
- their price expectation,
- whether they are available for a quick phone call with the investor's team.

CRITICAL CONSTRAINTS — never violate these:
- NEVER make an offer or state a purchase price, and never speculate about what the property is worth.
- NEVER book or schedule an appointment yourself. If the seller is available for a call, tell them the investor's team will reach out to arrange it.
- NEVER invent, confirm or contradict facts about the property that the seller has not stated.
- Keep every message short (1-3 sentences), plain and human. No lists, no jargon, no sales pressure.`;

/**
 * The persona + safety constraints for the seller assistant, optionally
 * extended with the investor's own AI instructions (from Settings). The
 * investor's guidance is appended as additional direction — it can focus the
 * assistant (e.g. preferred markets or property types) but never overrides the
 * CRITICAL CONSTRAINTS above.
 */
export function buildSystemPrompt(aiInstructions?: string | null): string {
  const extra = (aiInstructions ?? "").trim();
  if (!extra) return SELLER_ASSISTANT_SYSTEM_PROMPT;
  return `${SELLER_ASSISTANT_SYSTEM_PROMPT}\n\nAdditional investor guidance — follow these instructions from the investor you work for:\n${extra}`;
}

/** GPT model — env-overridable, defaults to the cheap-but-capable mini. */
export function chatModel(): string {
  // Kept configurable because Groq's available catalog differs by account and
  // changes over time. This default is available to the configured account.
  return process.env.AI_MODEL || (process.env.AI_PROVIDER === "groq" ? "qwen/qwen3.8-27b" : "gpt-4o-mini");
}

/** True when no configured provider key is set → deterministic simulation mode. */
export function isSimulatedMode(): boolean {
  return process.env.AI_PROVIDER === "groq" ? !process.env.GROQ_API_KEY : !process.env.OPENAI_API_KEY;
}

/* ---------------------------------------------------------------------- */
/* Real mode: plain fetch() to the OpenAI chat completions endpoint         */
/* ---------------------------------------------------------------------- */

/**
 * One chat completion round-trip. Throws on missing key / transport / API
 * errors — callers decide whether to fail or fall back to simulated.
 */
export async function openAiChatCompletion(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const groq = process.env.AI_PROVIDER === "groq";
  const apiKey = groq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(groq ? "GROQ_API_KEY is not set" : "OPENAI_API_KEY is not set");
  const response = await fetch(groq ? GROQ_CHAT_URL : OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel(),
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 300,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API error ${response.status}: ${body.slice(0, 300)}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response");
  return content;
}

/* ---------------------------------------------------------------------- */
/* Simulated mode: deterministic persona replies                            */
/* ---------------------------------------------------------------------- */

/**
 * Scripted follow-ups. Turn 0 is the opening message inserted by
 * startConversation; after each seller message the assistant advances one
 * step. Past the fixed sequence it closes warmly instead of looping.
 * Mirrors the real persona's qualifying arc (condition/timeline → reason and
 * price → call availability) and never makes offers or bookings on its own.
 */
const SIMULATED_FOLLOW_UPS: readonly string[] = [
  "Thanks, that helps a lot. Could you also tell me why you're looking to sell, and roughly what you're hoping for price-wise?",
  "Got it — I appreciate you sharing that. Would you be open to a quick phone call with the investor's team in the next day or two to talk through the details and timing?",
  "That's great to hear. I'll pass all of this along to the investor's team and they'll reach out to schedule the call. Is there anything else you'd like them to know about the property before then?",
];

/** Closing message used once every scripted follow-up has been asked. */
export const SIMULATED_CLOSING =
  "Thanks for taking the time to chat — I have what I need to hand over. The investor's team will be in touch to arrange a call with you. Have a great day!";

/** The conversation's opening message, written by the persona + lead facts. */
export function buildOpeningMessage(lead: {
  owner_name: string | null;
  city: string | null;
  state: string | null;
}): string {
  const firstName = (lead.owner_name ?? "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName}` : "Hi there";
  const where = [lead.city, lead.state].filter(Boolean).join(", ");
  const place = where ? ` in ${where}` : "";
  return `${greeting} — I'm reaching out on behalf of a local real-estate investor who buys properties directly from owners. We noticed your property${place} and were wondering if you've thought about selling. Could you tell me a bit about its condition and your timeline?`;
}

/** Turn index = number of seller messages already in the thread. */
export function simulatedAiReply(sellerMessageCount: number): string {
  const idx = sellerMessageCount - 1;
  if (idx >= 0 && idx < SIMULATED_FOLLOW_UPS.length) {
    return SIMULATED_FOLLOW_UPS[idx];
  }
  return SIMULATED_CLOSING;
}

/* ---------------------------------------------------------------------- */
/* Orchestration: build the assistant's next message from the thread        */
/* ---------------------------------------------------------------------- */

/** Map the stored thread to OpenAI message roles (assistant/seller). */
function threadToMessages(
  history: ConversationMessage[],
  systemPrompt: string,
): ChatMessage[] {
  const mapped: ChatMessage[] = history.map((m) => ({
    role: m.sender === "ai" ? ("assistant" as const) : ("user" as const),
    content: m.message,
  }));
  // Keep the window bounded so very long threads stay cheap.
  return [{ role: "system", content: systemPrompt }, ...mapped.slice(-20)];
}

/**
 * Produce the assistant's reply to the latest seller message.
 * Real mode calls OpenAI (with a graceful fall back to the script when the
 * API fails for any reason — the conversation must never break). Simulated
 * mode returns the scripted reply.
 *
 * When `opts.userId` is given, the user's saved AI instructions (Settings) are
 * appended to the system prompt so the assistant follows the investor's
 * guidance. Simulated mode is intentionally unchanged.
 */
export async function buildAiReply(
  history: ConversationMessage[],
  opts: { userId?: number } = {},
): Promise<string> {
  const sellerCount = history.filter((m) => m.sender === "seller").length;
  if (isSimulatedMode()) return simulatedAiReply(sellerCount);

  let systemPrompt = SELLER_ASSISTANT_SYSTEM_PROMPT;
  if (opts.userId != null) {
    try {
      const { getAiInstructionsForUser } = await import("./settings.server");
      systemPrompt = buildSystemPrompt(await getAiInstructionsForUser(opts.userId));
    } catch (err) {
      console.error(
        "[ai.server] could not load investor instructions, using base prompt:",
        err,
      );
    }
  }

  try {
    const content = await openAiChatCompletion(
      threadToMessages(history, systemPrompt),
      { maxTokens: 200 },
    );
    return content.slice(0, 2000);
  } catch (err) {
    console.error("[ai.server] OpenAI reply failed, falling back to script:", err);
    return simulatedAiReply(sellerCount);
  }
}
