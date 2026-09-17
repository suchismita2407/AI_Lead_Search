export type PlanId = "starter" | "pro" | "investor_plus";

export interface Plan {
  id: PlanId;
  name: string;
  monthlyUsd: number;
  monthlyUsdCents: number;
  leadLimit: number;
  blurb: string;
  features: readonly string[];
  highlighted?: boolean;
  /** Set in production from the matching Dodo Payments USD product ID. */
  dodoProductEnv: "DODO_PRODUCT_STARTER_USD" | "DODO_PRODUCT_PRO_USD" | "DODO_PRODUCT_INVESTOR_PLUS_USD";
}

export const PLANS: readonly Plan[] = [
  {
    id: "starter", name: "Starter", monthlyUsd: 29, monthlyUsdCents: 2900,
    leadLimit: 250, blurb: "For investors getting their pipeline moving.",
    features: ["250 leads per month", "AI qualification", "Basic follow-up", "Dashboard & lead scoring", "CSV lead upload with dedupe"],
    dodoProductEnv: "DODO_PRODUCT_STARTER_USD",
  },
  {
    id: "pro", name: "Pro", monthlyUsd: 79, monthlyUsdCents: 7900,
    leadLimit: 1000, blurb: "For active investors who want the full pipeline.",
    features: ["1,000 leads per month", "AI seller conversations", "Appointment booking", "Deal analysis", "Analytics", "CSV lead upload with dedupe"],
    highlighted: true, dodoProductEnv: "DODO_PRODUCT_PRO_USD",
  },
  {
    id: "investor_plus", name: "Investor+", monthlyUsd: 149, monthlyUsdCents: 14900,
    leadLimit: 2500, blurb: "For investors running multiple campaigns.",
    features: ["2,500 leads per month", "Multiple campaigns", "Advanced qualification", "Priority support", "Multiple users", "Everything in Pro"],
    dodoProductEnv: "DODO_PRODUCT_INVESTOR_PLUS_USD",
  },
] as const;

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}
