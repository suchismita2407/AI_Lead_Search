/**
 * DealFlow AI — lead RPC surface (client-safe module).
 *
 * Only `createServerFn` definitions live here. All real logic — DB access —
 * lives in `./leads.server.ts` (server-only; import-protection guarantees it
 * never ships to the browser). Handlers load it dynamically the moment they
 * execute, which only happens on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import type { LeadBand } from "./scoring";
export type {
  ImportLeadsResult,
  LeadDetail,
  LeadListItem,
} from "./leads.server";

/** Upload a leads CSV; parses, dedupes, scores and stores leads for the user. */
export const importLeadsCsv = createServerFn({ method: "POST" })
  .validator((d: { csv: string }) => d)
  .handler(async ({ data }) => {
    const { importLeadsCsvData } = await import("./leads.server");
    return await importLeadsCsvData(data.csv);
  });

/** All leads for the current user (newest first). */
export const listLeads = createServerFn().handler(async () => {
  const { listLeadsForUser } = await import("./leads.server");
  return await listLeadsForUser();
});

/** Single lead (this user's) with its signal breakdown, or null. */
export const getLead = createServerFn()
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const { getLeadForUser } = await import("./leads.server");
    return await getLeadForUser(data.id);
  });

/** Per-band counts used by summary chips — mirrors ImportLeadsResult.bands. */
export type BandCounts = Record<LeadBand, number>;