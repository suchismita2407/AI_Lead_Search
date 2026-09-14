/**
 * DealFlow AI — lead scoring engine (SERVER-ONLY).
 *
 * Computes screening signals and the normalized lead score. Never statically
 * imported by client-visible code — only reached inside server-fn handlers /
 * API routes via dynamic `await import()`.
 *
 * Signals are screening signals, not claims: each is a hypothesis inferred
 * from the lead row. Missing/unknown values award 0 points (never penalize).
 *
 * Weights (max 105): long ownership +15, high equity +20, vacant +20,
 * needs work +15, distress +15, absentee owner +10, recent listing
 * withdrawal +10. Normalized: lead_score = round(points / 105 * 100).
 */
import {
  MAX_SIGNAL_POINTS,
  SIGNAL_DEFS,
  scoreToBand,
  type LeadBand,
  type SignalBreakdownItem,
} from "./scoring";

/** Normalized input fields the scoring engine reads from a lead/CSV row. */
export interface ScoringInput {
  ownership_duration_years?: number | null;
  estimated_value?: number | null;
  estimated_equity?: number | null;
  vacancy_signal?: number | null;
  needs_work_signal?: number | null;
  distress_signal?: number | null;
  absentee_owner_signal?: number | null;
  recent_listing_withdrawal_signal?: number | null;
}

export interface ScoringResult {
  /** Raw signal points (0–105). */
  points: number;
  /** Normalized 0–100 score. */
  score: number;
  band: LeadBand;
  /** Per-signal breakdown, applied or not, with labels + points. */
  signals: SignalBreakdownItem[];
}

const asNumber = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const signalOn = (v: unknown): 0 | 1 =>
  asNumber(v) === 1 ? 1 : 0;

export function computeSignals(input: ScoringInput): ScoringResult {
  const ownership = asNumber(input.ownership_duration_years);
  const value = asNumber(input.estimated_value);
  const equity = asNumber(input.estimated_equity);

  const checks: Record<string, boolean> = {
    longOwnership: ownership != null && ownership >= 10,
    highEquity:
      value != null && equity != null && value > 0 && equity >= 0.5 * value,
    vacant: signalOn(input.vacancy_signal) === 1,
    needsWork: signalOn(input.needs_work_signal) === 1,
    distress: signalOn(input.distress_signal) === 1,
    absenteeOwner: signalOn(input.absentee_owner_signal) === 1,
    listingWithdrawal: signalOn(input.recent_listing_withdrawal_signal) === 1,
  };

  const signals: SignalBreakdownItem[] = SIGNAL_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    points: def.weight,
    applied: checks[def.key] ?? false,
  }));

  const points = signals.reduce(
    (sum, s) => sum + (s.applied ? s.points : 0),
    0,
  );
  const score = Math.round((points / MAX_SIGNAL_POINTS) * 100);
  const band = scoreToBand(score) ?? "LOW";

  return { points, score, band, signals };
}

/** Convenience: recompute scores for every lead of a user (dashboard etc.). */
export function bandForScore(score: number | null | undefined): LeadBand | null {
  return scoreToBand(score);
}