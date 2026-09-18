/**
 * DealFlow AI — saved-deal operations (SERVER-ONLY).
 *
 * Save/delete/list deal analyses from the Deal Analyzer. Every query is scoped
 * to the session user; a deal only ever touches leads the user owns, and the
 * server recomputes estimated profit + ROI from the submitted amounts (shared
 * `computeDeal`) so stored numbers never trust the client.
 *
 * SERVER-ONLY: never statically imported by client-visible code — reached only
 * via the RPC definitions in `./deals.ts`, whose handlers dynamically import
 * this module.
 */
import { sql } from "~/db";
import { requireWorkspaceAccess } from "./auth.server";
import { computeDeal, type DealInputs } from "./analyzer";

export interface SavedDeal {
  id: number;
  lead_id: number;
  owner_name: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchase_price: number | null;
  rehab: number | null;
  arv: number | null;
  closing_costs: number | null;
  holding_costs: number | null;
  selling_costs: number | null;
  estimated_profit: number | null;
  roi: number | null;
  created_at: string;
}

export type SaveDealResult =
  | { error: string }
  | { deal: SavedDeal }
  | null;

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toSavedDeal(row: Record<string, unknown>): SavedDeal {
  return {
    id: Number(row.id),
    lead_id: Number(row.lead_id),
    owner_name: row.owner_name == null ? null : String(row.owner_name),
    property_address:
      row.property_address == null ? null : String(row.property_address),
    city: row.city == null ? null : String(row.city),
    state: row.state == null ? null : String(row.state),
    zip: row.zip == null ? null : String(row.zip),
    purchase_price: toNumber(row.purchase_price),
    rehab: toNumber(row.rehab),
    arv: toNumber(row.arv),
    closing_costs: toNumber(row.closing_costs),
    holding_costs: toNumber(row.holding_costs),
    selling_costs: toNumber(row.selling_costs),
    estimated_profit: toNumber(row.estimated_profit),
    roi: toNumber(row.roi),
    created_at: String(row.created_at ?? ""),
  };
}

/** All saved deals for the current user, newest first. */
export async function listDealsForUser(): Promise<SavedDeal[]> {
  const user = await requireWorkspaceAccess();
  const rows = await sql()`
    SELECT d.id, d.lead_id, d.purchase_price, d.rehab, d.arv, d.closing_costs,
           d.holding_costs, d.selling_costs, d.estimated_profit, d.roi,
           d.created_at,
           l.owner_name, l.property_address, l.city, l.state, l.zip
    FROM deals d
    JOIN leads l ON l.id = d.lead_id
    WHERE l.user_id = ${user.id}
    ORDER BY d.id DESC
  `;
  return rows.map(toSavedDeal);
}

/**
 * Save a deal analysis against one of the user's leads. The server recomputes
 * estimated profit + ROI from the six amounts via the shared `computeDeal`;
 * returns { error } when the deal is incomplete or the lead isn't the user's.
 */
export async function saveDealForUser(input: {
  leadId: number;
  purchase: number | null;
  rehab: number | null;
  closing: number | null;
  holding: number | null;
  selling: number | null;
  arv: number | null;
}): Promise<SaveDealResult> {
  const user = await requireWorkspaceAccess();
  const leadId = Number(input.leadId);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return { error: "Pick a lead to attach this deal to." };
  }
  const lead = (await sql()`
    SELECT id FROM leads WHERE id = ${leadId} AND user_id = ${user.id}
  `)[0];
  if (!lead) return null;

  const amounts: DealInputs = {
    purchase: toNumber(input.purchase),
    rehab: toNumber(input.rehab),
    closing: toNumber(input.closing),
    holding: toNumber(input.holding),
    selling: toNumber(input.selling),
    arv: toNumber(input.arv),
  };
  const result = computeDeal(amounts);
  if (!result.complete || result.totalCost === null || result.estimatedProfit === null) {
    return {
      error: "Enter at least a purchase price and ARV before saving the deal.",
    };
  }

  const id = await sql().insert`
    INSERT INTO deals (
      lead_id, purchase_price, rehab, arv, closing_costs, holding_costs,
      selling_costs, estimated_profit, roi
    ) VALUES (
      ${leadId}, ${amounts.purchase}, ${amounts.rehab}, ${amounts.arv},
      ${amounts.closing}, ${amounts.holding}, ${amounts.selling},
      ${result.estimatedProfit}, ${result.roi}
    )
  `;
  const rows = await sql()`
    SELECT d.id, d.lead_id, d.purchase_price, d.rehab, d.arv, d.closing_costs,
           d.holding_costs, d.selling_costs, d.estimated_profit, d.roi,
           d.created_at,
           l.owner_name, l.property_address, l.city, l.state, l.zip
    FROM deals d
    JOIN leads l ON l.id = d.lead_id
    WHERE d.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return { deal: toSavedDeal(row) };
}

/** Delete one of the user's saved deals. Returns false when it isn't theirs. */
export async function deleteDealForUser(dealId: number): Promise<boolean> {
  const user = await requireWorkspaceAccess();
  const target = Number(dealId);
  if (!Number.isFinite(target)) return false;
  const result = await sql().run`
    DELETE FROM deals
    WHERE id = ${target}
      AND lead_id IN (SELECT id FROM leads WHERE user_id = ${user.id})
  `;
  return result.changes > 0;
}
