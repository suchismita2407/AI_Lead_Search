/**
 * DealFlow AI — seller conversation RPC surface (client-safe module).
 *
 * Only `createServerFn` definitions live here. All real logic — DB access,
 * AI calls, qualification — lives in `./conversations.server.ts` /
 * `./qualification.server.ts` / `./ai.server.ts` (server-only). Handlers load
 * them dynamically the moment they execute, which only happens on the server.
 */
import { createServerFn } from "@tanstack/react-start";
export type {
  AppointmentSnapshot,
  ConversationMessage,
  ConversationSnapshot,
  LeadStatusSummary,
} from "./conversations.server";
export type { QualificationRecord } from "./qualification.server";

/** Open the seller conversation: inserts the persona's first question. */
export const startConversation = createServerFn({ method: "POST" })
  .validator((d: { leadId: number }) => d)
  .handler(async ({ data }) => {
    const { startConversationForLead } = await import("./conversations.server");
    return await startConversationForLead(data.leadId);
  });

/** Append a seller message, generate + store the AI reply, requalify. */
export const sendSellerMessage = createServerFn({ method: "POST" })
  .validator((d: { leadId: number; message: string }) => d)
  .handler(async ({ data }) => {
    const { sendSellerMessageForLead } = await import("./conversations.server");
    return await sendSellerMessageForLead(data.leadId, data.message);
  });

/** Investor action: schedule a call with a (qualified) seller. */
export const bookAppointment = createServerFn({ method: "POST" })
  .validator((d: { leadId: number; date: string; time: string }) => d)
  .handler(async ({ data }) => {
    const { bookAppointmentForLead } = await import("./conversations.server");
    return await bookAppointmentForLead(data.leadId, data.date, data.time);
  });