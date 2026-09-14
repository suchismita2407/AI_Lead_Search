/**
 * DealFlow AI — lead scoring, CLIENT-SAFE shared module.
 *
 * The single source of truth for signal weights, signal labels and the
 * score-to-band mapping. Both the server (`scoring.server.ts` computes the
 * score) and the UI (bands, breakdown labels, filters) import from here so they
 * can never drift apart.
 *
 * IMPORTANT: these are SCREENING SIGNALS, not claims. A signal is a hypothesis
 * drawn from lead data (e.g. "long ownership", "high equity"); it says nothing
 * definitive about the seller. The UI must label them as signals.
 */
export type LeadBand = "HOT" | "WARM" | "NURTURE" | "LOW";

export const BANDS: readonly LeadBand[] = ["HOT", "WARM", "NURTURE", "LOW"];

export interface SignalBreakdownItem {
  /** Stable key, e.g. "longOwnership". */
  key: string;
  /** Human label, e.g. "Long ownership". */
  label: string;
  /** Points awarded when the signal fires. */
  points: number;
  /** Whether the signal was detected for this lead. */
  applied: boolean;
}

export interface SignalDef {
  key: string;
  label: string;
  weight: number;
  /** Plain-language description of what the signal means — shown in the UI. */
  description: string;
}

/** Canonical screening signals and their weights (product spec). */
export const SIGNAL_DEFS: readonly SignalDef[] = [
  {
    key: "longOwnership",
    label: "Long ownership",
    weight: 15,
    description: "Seller has owned the property for 10+ years.",
  },
  {
    key: "highEquity",
    label: "High equity",
    weight: 20,
    description: "Estimated equity is at least 50% of estimated value.",
  },
  {
    key: "vacant",
    label: "Vacant",
    weight: 20,
    description: "The property appears vacant.",
  },
  {
    key: "needsWork",
    label: "Needs work",
    weight: 15,
    description: "The property appears to need repairs.",
  },
  {
    key: "distress",
    label: "Financial distress",
    weight: 15,
    description: "Signs of financial distress (taxes, liens, foreclosure).",
  },
  {
    key: "absenteeOwner",
    label: "Absentee owner",
    weight: 10,
    description: "Owner does not appear to live at the property.",
  },
  {
    key: "listingWithdrawal",
    label: "Recent listing withdrawal",
    weight: 10,
    description: "A listing for this property was withdrawn recently.",
  },
];

/** Maximum achievable signal points (used to normalize to 0–100). */
export const MAX_SIGNAL_POINTS = 105;

/**
 * Map a normalized 0–100 lead score to its band.
 *
 * Bands: HOT 80–100 · WARM 60–79 · NURTURE 40–59 · LOW <40.
 * Returns null when the score is missing, so unknown leads are never
 * silently bucketed into LOW.
 */
export function scoreToBand(score: number | null | undefined): LeadBand | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= 80) return "HOT";
  if (score >= 60) return "WARM";
  if (score >= 40) return "NURTURE";
  return "LOW";
}

/** Formatter for currency columns (client + server safe). */
export function formatCurrency(
  value: number | null | undefined,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/* ---------------------------------------------------------------------- */
/* Seller qualification (AI conversation output, /25)                       */
/* ---------------------------------------------------------------------- */

/**
 * The five qualification dimensions, scored 0–5 each (total /25). Shared by
 * the server (scoring) and the UI (labels), so they can never drift apart.
 */
export const QUALIFICATION_DIMS = [
  { key: "motivation", label: "Motivation" },
  { key: "timeline", label: "Timeline" },
  { key: "condition", label: "Condition" },
  { key: "price_flexibility", label: "Price flexibility" },
  { key: "contactability", label: "Contactability" },
] as const;

/**
 * Map a /25 qualification total to its band. Distinct from lead scoreToBand():
 * 20–25 HOT · 15–19 WARM · 10–14 NURTURE · <10 LOW. A lead becomes qualified
 * (status 'qualified') at total >= 15.
 */
export function qualificationBand(
  total: number | null | undefined,
): LeadBand | null {
  if (total == null || Number.isNaN(total)) return null;
  if (total >= 20) return "HOT";
  if (total >= 15) return "WARM";
  if (total >= 10) return "NURTURE";
  return "LOW";
}