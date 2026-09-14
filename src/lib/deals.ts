/**
 * DealFlow AI — saved-deal RPC surface (client-safe module).
 *
 * Only `createServerFn` definitions live here. All real logic (DB access,
 * user scoping, recomputed profit/ROI) lives in `./deals.server.ts`
 * (server-only), reached via dynamic import inside each handler.
 */
import { createServerFn } from "@tanstack/react-start";
export type { SavedDeal, SaveDealResult } from "./deals.server";

/** All saved deals for the current user, newest first. */
export const listDeals = createServerFn().handler(async () => {
  const { listDealsForUser } = await import("./deals.server");
  return await listDealsForUser();
});

/** Save a deal analysis against one of the user's leads. */
export const saveDeal = createServerFn({ method: "POST" })
  .validator(
    (d: {
      leadId: number;
      purchase: number | null;
      rehab: number | null;
      closing: number | null;
      holding: number | null;
      selling: number | null;
      arv: number | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { saveDealForUser } = await import("./deals.server");
    return await saveDealForUser(data);
  });

/** Delete one of the user's saved deals. */
export const deleteDeal = createServerFn({ method: "POST" })
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const { deleteDealForUser } = await import("./deals.server");
    return await deleteDealForUser(data.id);
  });