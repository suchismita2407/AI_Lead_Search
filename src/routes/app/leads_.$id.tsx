import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getLead } from "~/lib/leads";
import { formatCurrency, scoreToBand } from "~/lib/scoring";

export const Route = createFileRoute("/app/leads_/$id")({
  loader: async ({ params }) =>
    getLead({ data: { id: Number(params.id) } }),
  component: LeadDetailPage,
});

const bandBadge: Record<string, string> = {
  HOT: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  WARM: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  NURTURE:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const bandText: Record<string, string> = {
  HOT: "text-red-600 dark:text-red-400",
  WARM: "text-amber-600 dark:text-amber-400",
  NURTURE: "text-blue-600 dark:text-blue-400",
  LOW: "text-gray-500 dark:text-gray-400",
};

function Fact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}

function LeadDetailPage() {
  const lead = Route.useLoaderData();

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          to="/app/leads"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          ← Back to Leads
        </Link>
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Lead not found, or it doesn't belong to your account.
        </div>
      </div>
    );
  }

  const band = scoreToBand(lead.lead_score);
  const address =
    [lead.property_address, lead.city, lead.state, lead.zip]
      .filter(Boolean)
      .join(", ") || "—";
  const createdDate = lead.created_at.slice(0, 10) || "—";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/leads"
        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        ← Back to Leads
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {lead.owner_name ?? "Unnamed owner"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {address}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-4xl font-bold tabular-nums ${band ? bandText[band] : "text-gray-400"}`}>
            {lead.lead_score ?? "—"}
          </p>
          {band ? (
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandBadge[band]}`}
            >
              {band}
            </span>
          ) : null}
        </div>
      </div>

      {/* Inert action placeholders (next milestone: book call, mark hot, notes, archive) */}
      <div className="mt-5 flex flex-wrap gap-2">
        {["BOOK CALL", "MARK HOT", "ADD NOTE", "ARCHIVE"].map((label) => (
          <button
            key={label}
            type="button"
            title="Coming in a later milestone"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold tracking-wide text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lead facts */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-3 dark:border-gray-800 dark:bg-gray-900">
        <Fact label="Property type" value={lead.property_type ?? "—"} />
        <Fact
          label="Estimated value"
          value={formatCurrency(lead.estimated_value)}
        />
        <Fact
          label="Estimated equity"
          value={formatCurrency(lead.estimated_equity)}
        />
        <Fact label="Status" value={lead.status ?? "—"} />
        <Fact label="Added on" value={createdDate} />
      </dl>

      {/* Signal breakdown */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Screening signals
          </h2>
          {lead.lead_score != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Score = {lead.lead_score}/100 from screening signals
            </p>
          )}
        </div>
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {lead.signals.map((s) => (
            <li
              key={s.key}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.applied
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600"
                  }`}
                >
                  {s.applied ? "✓" : "•"}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {s.label}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      +{s.points} pts
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {s.applied
                      ? "Detected — screening signal, not a claim."
                      : "Not detected for this lead."}
                  </p>
                </div>
              </div>
              <span
                className={`mt-1 shrink-0 text-xs font-semibold ${
                  s.applied ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600"
                }`}
              >
                {s.applied ? `+${s.points}` : "0"}
              </span>
            </li>
          ))}
          {lead.signals.length === 0 && (
            <li className="py-4 text-sm text-gray-500 dark:text-gray-400">
              No signal data recorded for this lead.
            </li>
          )}
        </ul>
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Screening signals are hypotheses drawn from lead data — indicators to
          investigate, not verified claims about the seller. Qualification
          happens in the AI seller conversation.
        </p>
      </div>
    </div>
  );
}