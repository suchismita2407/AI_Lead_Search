/**
 * DealFlow AI — campaign RPC surface (client-safe module).
 *
 * Only `createServerFn` definitions live here. All real logic (DB access,
 * user scoping) lives in `./campaigns.server.ts` (server-only), reached via
 * dynamic import inside the handler.
 */
import { createServerFn } from "@tanstack/react-start";
export type { CampaignStats } from "./campaigns.server";

/** Live pipeline counts for the current user's default campaign. */
export const campaignStats = createServerFn().handler(async () => {
  const { campaignStatsForUser } = await import("./campaigns.server");
  return await campaignStatsForUser();
});