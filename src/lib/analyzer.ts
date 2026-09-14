/**
 * DealFlow AI — deal analyzer math (CLIENT-SAFE shared util).
 *
 * Pure functions used by BOTH the analyzer page (live calc) and the server
 * save-deal handler (recomputes profit/ROI so stored numbers never trust the
 * client). No imports from `.server.ts` modules — the route page imports this
 * directly.
 *
 * Model (mirrors the owner's spec example):
 *
 *   Total cost      = purchase + rehab + closing + holding + selling
 *   Est. profit     = ARV − total cost
 *   ROI             = est. profit / total cost   (guard: total cost > 0)
 *   Deal score      = clamp(round(profitMarginPct × 4 + 15), 0, 100)
 *                     where profitMarginPct = est. profit / total cost × 100
 *   Recommendation  = ROI ≥ 18% STRONG OPPORTUNITY ·
 *                     ROI 10%–18% REVIEW · ROI < 10% PASS
 *
 * The owner's example (Purchase $120k, Rehab $40k, Closing $8k, Holding $7k,
 * Selling $15k, ARV $220k) reproduces exactly: total cost $190,000, est.
 * profit $30,000, ROI 15.8%, score 78/100, recommendation REVIEW.
 */
export interface DealInputs {
  purchase: number | null;
  rehab: number | null;
  closing: number | null;
  holding: number | null;
  selling: number | null;
  arv: number | null;
}

export interface DealResult {
  totalCost: number | null;
  estimatedProfit: number | null;
  /** ROI as a percent (e.g. 15.79) or null when not computable. */
  roi: number | null;
  /** 0–100 deal score, or null when inputs are incomplete. */
  score: number | null;
  /** Recommendation label when computable, else null. */
  recommendation: Recommendation | null;
  /** True when purchase + ARV are present and usable. */
  complete: boolean;
}

export type Recommendation = "STRONG OPPORTUNITY" | "REVIEW" | "PASS";

export const RECOMMENDATION_RULES = [
  { label: "STRONG OPPORTUNITY", rule: "ROI ≥ 18%" },
  { label: "REVIEW", rule: "ROI 10%–18%" },
  { label: "PASS", rule: "ROI < 10%" },
] as const;

const SCORE_MARGIN_POINTS_PER_PCT = 4;
const SCORE_BASE_POINTS = 15;
export const STRONG_ROI_PCT = 18;
export const REVIEW_ROI_PCT = 10;

/** Non-negative number, or null when the value is missing/blank/invalid. */
function toAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function computeDeal(inputs: DealInputs): DealResult {
  const purchase = toAmount(inputs.purchase);
  const arv = toAmount(inputs.arv);
  // Essentials: purchase + ARV (must be present and positive). Everything else
  // is optional (0 when omitted).
  if (
    purchase === null ||
    arv === null ||
    purchase <= 0 ||
    arv <= 0
  ) {
    return {
      totalCost: null,
      estimatedProfit: null,
      roi: null,
      score: null,
      recommendation: null,
      complete: false,
    };
  }
  const rehab = toAmount(inputs.rehab) ?? 0;
  const closing = toAmount(inputs.closing) ?? 0;
  const holding = toAmount(inputs.holding) ?? 0;
  const selling = toAmount(inputs.selling) ?? 0;
  const totalCost = purchase + rehab + closing + holding + selling;
  const estimatedProfit = arv - totalCost;
  const roi = totalCost > 0 ? (estimatedProfit / totalCost) * 100 : null;
  const marginPct = roi ?? 0;
  const score = Math.max(
    0,
    Math.min(100, Math.round(marginPct * SCORE_MARGIN_POINTS_PER_PCT + SCORE_BASE_POINTS)),
  );
  const recommendation = recommendDeal(roi);
  return {
    totalCost,
    estimatedProfit,
    roi,
    score,
    recommendation,
    complete: true,
  };
}

/** Deal recommendation from ROI — see RECOMMENDATION_RULES (shown in the UI). */
export function recommendDeal(roi: number | null): Recommendation | null {
  if (roi === null) return null;
  if (roi >= STRONG_ROI_PCT) return "STRONG OPPORTUNITY";
  if (roi >= REVIEW_ROI_PCT) return "REVIEW";
  return "PASS";
}