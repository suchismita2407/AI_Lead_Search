/**
 * DealFlow AI — campaign pipeline stats (SERVER-ONLY).
 *
 * The MVP has one read-only campaign ("Detroit Seller Outreach", name
 * hardcoded in the page) whose pipeline counts are computed live from the
 * user's leads:
 *
 *   Total        — every lead the user owns
 *   Contacted    — status is contacted/qualified/booked, or the lead has at
 *                  least one conversation message (any sender)
 *   Responses    — the lead has at least one SELLER message (actual reply)
 *   Qualified    — qualification total_score >= 15 (shared constant)
 *   Appointments — at least one appointment row for the lead
 *
 * SERVER-ONLY: never statically imported by client-visible code — reached only
 * via the RPC definitions in `./campaigns.ts`, whose handlers dynamically
 * import this module.
 */
import { sql } from "~/db";
import { requireWorkspaceAccess } from "./auth.server";
import { QUALIFIED_TOTAL } from "./qualification.server";

export interface CampaignStats {
  total: number;
  contacted: number;
  responses: number;
  qualified: number;
  appointments: number;
}

/** Live pipeline counts for the current user's default campaign. */
export async function campaignStatsForUser(): Promise<CampaignStats> {
  const user = await requireWorkspaceAccess();

  const [totals] = await sql()`
    SELECT
      (SELECT COUNT(*) FROM leads WHERE user_id = ${user.id}) AS total,
      (SELECT COUNT(*) FROM leads l
        WHERE l.user_id = ${user.id}
          AND (l.status IN ('contacted','qualified','booked')
               OR EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = l.id))
      ) AS contacted,
      (SELECT COUNT(*) FROM leads l
        WHERE l.user_id = ${user.id}
          AND EXISTS (SELECT 1 FROM conversations c
                      WHERE c.lead_id = l.id AND c.sender = 'seller')
      ) AS responses,
      (SELECT COUNT(*) FROM leads l
        JOIN qualification q ON q.lead_id = l.id
        WHERE l.user_id = ${user.id} AND q.total_score >= ${QUALIFIED_TOTAL}
      ) AS qualified,
      (SELECT COUNT(*) FROM leads l
        JOIN appointments a ON a.lead_id = l.id
        WHERE l.user_id = ${user.id}
      ) AS appointments
  `;

  return {
    total: Number(totals?.total ?? 0),
    contacted: Number(totals?.contacted ?? 0),
    responses: Number(totals?.responses ?? 0),
    qualified: Number(totals?.qualified ?? 0),
    appointments: Number(totals?.appointments ?? 0),
  };
}
