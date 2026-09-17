import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { analyzeDealWithAi, listDeals, saveDeal, deleteDeal } from "~/lib/deals";
import type { SavedDeal } from "~/lib/deals";
import { listLeads } from "~/lib/leads";
import type { LeadListItem } from "~/lib/leads";
import {
  computeDeal,
  RECOMMENDATION_RULES,
  type Recommendation,
} from "~/lib/analyzer";
import { formatCurrency } from "~/lib/scoring";

export const Route = createFileRoute("/app/analyzer")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Deal Analyzer" }],
  }),
  loader: async () => {
    const [leads, deals] = await Promise.all([listLeads(), listDeals()]);
    return { leads, deals };
  },
  component: AnalyzerPage,
});

const recBadge: Record<Recommendation, string> = {
  "STRONG OPPORTUNITY":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  REVIEW:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  PASS: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

/** Live parse of a currency input: numeric string → number | null. */
function parseAmount(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function ScoreBar({ score }: { score: number }) {
  const blocks = 10;
  const filled = Math.max(0, Math.min(blocks, Math.round((score / 100) * blocks)));
  return (
    <div>
      <p className="font-mono text-lg tracking-tight text-gray-900 dark:text-white">
        {"▓".repeat(filled)}
        {"░".repeat(blocks - filled)}{" "}
        <span className="tabular-nums">{score}/100</span>
      </p>
      <div className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          accent ?? "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AnalyzerPage() {
  const initial = Route.useLoaderData();
  const [purchase, setPurchase] = useState("");
  const [rehab, setRehab] = useState("");
  const [closing, setClosing] = useState("");
  const [holding, setHolding] = useState("");
  const [selling, setSelling] = useState("");
  const [arv, setArv] = useState("");
  const [leadId, setLeadId] = useState<number | "">(
    initial.leads[0]?.id ?? "",
  );
  const [deals, setDeals] = useState<SavedDeal[]>(initial.deals);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const result = computeDeal({
    purchase: parseAmount(purchase),
    rehab: parseAmount(rehab),
    closing: parseAmount(closing),
    holding: parseAmount(holding),
    selling: parseAmount(selling),
    arv: parseAmount(arv),
  });

  const roiText =
    result.roi === null
      ? "—"
      : `${result.roi.toFixed(1)}%`;
  const profitText =
    result.estimatedProfit === null ? "—" : formatCurrency(result.estimatedProfit);
  const totalText =
    result.totalCost === null ? "—" : formatCurrency(result.totalCost);

  function leadLabel(lead: LeadListItem): string {
    const address = [lead.property_address, lead.city, lead.state]
      .filter(Boolean)
      .join(", ");
    return `${lead.owner_name ?? "Unnamed owner"} — ${address || "no address"}`;
  }

  async function handleSave() {
    if (saving || !result.complete) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const res = await saveDeal({
        data: {
          leadId: Number(leadId),
          purchase: parseAmount(purchase),
          rehab: parseAmount(rehab),
          closing: parseAmount(closing),
          holding: parseAmount(holding),
          selling: parseAmount(selling),
          arv: parseAmount(arv),
        },
      });
      if (!res) {
        setSaveError("That lead isn't yours anymore — pick another and retry.");
      } else if ("error" in res) {
        setSaveError(res.error);
      } else {
        setDeals((prev) => [res.deal, ...prev.filter((d) => d.id !== res.deal.id)]);
        setSaveMsg("Deal saved to your pipeline.");
      }
    } catch {
      setSaveError("Saving failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (deletingId !== null) return;
    setDeletingId(id);
    setSaveError(null);
    try {
      await deleteDeal({ data: { id } });
      setDeals((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setSaveError("Delete failed — try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAiReview() {
    if (!result.complete || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    try {
      const review = await analyzeDealWithAi({ data: {
        purchase: parseAmount(purchase), rehab: parseAmount(rehab), closing: parseAmount(closing),
        holding: parseAmount(holding), selling: parseAmount(selling), arv: parseAmount(arv),
      } });
      if ("error" in review) setAiError(review.error);
      else setAiSummary(review.summary);
    } catch {
      setAiError("Could not get an AI review. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Deal Analyzer
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Model a flip or wholesale deal: purchase price, rehab, ARV and
        estimated profit.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Inputs */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Deal inputs
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Purchase price and ARV are required; the rest default to $0 when
            left blank.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Purchase price <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={purchase}
                onChange={(e) => setPurchase(e.target.value)}
                aria-label="Purchase price"
                placeholder="120000"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                ARV <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={arv}
                onChange={(e) => setArv(e.target.value)}
                aria-label="After repair value"
                placeholder="220000"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Rehab
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={rehab}
                onChange={(e) => setRehab(e.target.value)}
                aria-label="Rehab costs"
                placeholder="40000"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Closing costs
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                aria-label="Closing costs"
                placeholder="8000"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Holding costs
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={holding}
                onChange={(e) => setHolding(e.target.value)}
                aria-label="Holding costs"
                placeholder="7000"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Selling costs
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={selling}
                onChange={(e) => setSelling(e.target.value)}
                aria-label="Selling costs"
                placeholder="15000"
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>
        </section>

        {/* Results */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Deal summary
              </h2>
              {result.recommendation ? (
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${recBadge[result.recommendation]}`}
                >
                  {result.recommendation}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ResultCard label="Total cost" value={totalText} />
              <ResultCard
                label="Estimated profit"
                value={profitText}
                accent={
                  result.estimatedProfit !== null && result.estimatedProfit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              />
              <ResultCard label="ROI" value={roiText} />
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Deal score
                </p>
                <div className="mt-2">
                  {result.score === null ? (
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      —
                    </p>
                  ) : (
                    <ScoreBar score={result.score} />
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ESTIMATE — not a guarantee. Numbers are your inputs; profit and
              ROI are projections, not promises.
            </p>

            <button
              type="button"
              onClick={handleAiReview}
              disabled={!result.complete || aiLoading}
              className="mt-4 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading ? "Reviewing deal…" : "Ask AI: Should I proceed?"}
            </button>
            {!result.complete ? <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Enter purchase price and ARV first.</p> : null}
            {aiError ? <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{aiError}</p> : null}
            {aiSummary ? (
              <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-gray-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-gray-200">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">AI deal review</p>
                <div className="whitespace-pre-wrap">{aiSummary}</div>
              </div>
            ) : null}

            {result.complete ? (
              <dl className="mt-4 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                <dt className="font-semibold text-gray-500 dark:text-gray-400">
                  How the score works
                </dt>
                <dd>
                  Score = profit margin × 4 + 15 (capped 0–100). Margin
                  21.25%+ = 100.
                </dd>
                <dd>
                  Recommendation: {RECOMMENDATION_RULES.map((r) => (
                    <span key={r.label}>
                      {r.label} = {r.rule}
                      {r.label === "PASS" ? "" : " · "}
                    </span>
                  ))}
                </dd>
              </dl>
            ) : (
              <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                Enter a purchase price and ARV to see the estimate.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Save deal */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Save deal
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Attach this analysis to one of your leads. Optional — the
              calculator works without saving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={leadId === "" ? "" : String(leadId)}
              onChange={(e) =>
                setLeadId(e.target.value === "" ? "" : Number(e.target.value))
              }
              aria-label="Attach deal to lead"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="" disabled>
                {initial.leads.length === 0
                  ? "No leads yet — upload a CSV first"
                  : "Choose a lead…"}
              </option>
              {initial.leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {leadLabel(lead)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !result.complete || leadId === ""}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "SAVE DEAL"}
            </button>
          </div>
        </div>
        {saveMsg ? (
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {saveMsg}
          </p>
        ) : null}
        {saveError ? (
          <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
            {saveError}
          </p>
        ) : null}
        {!result.complete && leadId !== "" ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Complete the purchase price and ARV to enable saving.
          </p>
        ) : null}
      </section>

      {/* Saved deals */}
      <section className="mt-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Saved deals
        </h2>
        {deals.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            No saved deals yet — model a deal above and hit SAVE DEAL.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Address</th>
                  <th className="px-4 py-3 font-semibold">Purchase</th>
                  <th className="px-4 py-3 font-semibold">ARV</th>
                  <th className="px-4 py-3 font-semibold">Est. profit</th>
                  <th className="px-4 py-3 font-semibold">ROI</th>
                  <th className="px-4 py-3 font-semibold">Saved</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {deals.map((deal) => {
                  const address = [deal.property_address, deal.city, deal.state]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr key={deal.id}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {deal.owner_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {address || "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
                        {formatCurrency(deal.purchase_price)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
                        {formatCurrency(deal.arv)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(deal.estimated_profit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-white">
                        {deal.roi === null ? "—" : `${deal.roi.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {deal.created_at.slice(0, 10) || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(deal.id)}
                          disabled={deletingId !== null}
                          aria-label={`Delete deal for ${deal.owner_name ?? "lead"}`}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        >
                          {deletingId === deal.id ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="mt-4" />
    </div>
  );
}

export default AnalyzerPage;
