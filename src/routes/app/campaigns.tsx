import { createFileRoute, Link } from "@tanstack/react-router";
import { campaignStats } from "~/lib/campaigns";

export const Route = createFileRoute("/app/campaigns")({
  loader: async () => campaignStats(),
  component: CampaignsPage,
});

const statPlaceholder = {
  total: 0,
  contacted: 0,
  responses: 0,
  qualified: 0,
  appointments: 0,
};

function CampaignCard({ stats }: { stats: typeof statPlaceholder }) {
  const rows = [
    { key: "total" as const, label: "Leads", value: stats.total },
    { key: "contacted" as const, label: "Contacted", value: stats.contacted },
    { key: "responses" as const, label: "Responses", value: stats.responses },
    { key: "qualified" as const, label: "Qualified", value: stats.qualified },
    { key: "appointments" as const, label: "Appointments", value: stats.appointments },
  ];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 11l19-9-9 19-2-8-8-2z" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Detroit Seller Outreach
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Default campaign — live counts from your lead pipeline
            </p>
          </div>
        </div>
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
          Active
        </span>
      </div>

      {stats.total === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No leads in this campaign yet.{" "}
          <Link
            to="/app/leads"
            className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Upload a lead CSV
          </Link>{" "}
          to start populating the pipeline.
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {row.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {row.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
        Contacted = status contacted/qualified/booked or any conversation
        started · Responses = at least one seller reply · Qualified =
        qualification score ≥ 15/25. Read-only for now — campaign setup
        (SMS/email outreach) arrives after the core pipeline ships.
      </p>
    </div>
  );
}

function CampaignsPage() {
  const stats = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Campaigns
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Track outreach for your lead lists. One read-only campaign for now.
      </p>

      <div className="mt-6">
        <CampaignCard stats={stats} />
      </div>
    </div>
  );
}

export default CampaignsPage;