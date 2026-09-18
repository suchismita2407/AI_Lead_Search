import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { BANDS, scoreToBand } from "~/lib/scoring";
import type { LeadBand } from "~/lib/scoring";

export const dashboardStats = createServerFn().handler(async () => {
  const { requireWorkspaceAccess } = await import("~/lib/auth.server");
  const user = await requireWorkspaceAccess();
  const [counts] = await sql()`
    SELECT COUNT(*) AS total FROM leads WHERE user_id = ${user.id}
  `;
  // Bands MUST come from the shared scoreToBand() so dashboard, leads list and
  // detail page can never disagree about what a score means.
  const scoreRows = await sql()`
    SELECT lead_score FROM leads
    WHERE user_id = ${user.id} AND lead_score IS NOT NULL
  `;
  const bandCounts: Record<LeadBand, number> = {
    HOT: 0,
    WARM: 0,
    NURTURE: 0,
    LOW: 0,
  };
  for (const row of scoreRows) {
    const band = scoreToBand(Number(row.lead_score));
    if (band) bandCounts[band] += 1;
  }
  const [appts] = await sql()`
    SELECT COUNT(*) AS total
    FROM appointments a
    JOIN leads l ON l.id = a.lead_id
    WHERE l.user_id = ${user.id}
  `;
  return {
    total: Number(counts?.total ?? 0),
    hot: bandCounts.HOT,
    warm: bandCounts.WARM,
    nurture: bandCounts.NURTURE,
    low: bandCounts.LOW,
    appointments: Number(appts?.total ?? 0),
  };
});

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Dashboard" }],
  }),
  loader: async () => dashboardStats(),
  component: Dashboard,
});

const bandTint: Record<LeadBand, string> = {
  HOT: "text-red-600 dark:text-red-400",
  WARM: "text-amber-600 dark:text-amber-400",
  NURTURE: "text-blue-600 dark:text-blue-400",
  LOW: "text-gray-500 dark:text-gray-400",
};

function Dashboard() {
  const stats = Route.useLoaderData();
  const bandCards: Array<{ band: LeadBand; value: number }> = BANDS.map(
    (band) => ({ band, value: stats[band.toLowerCase() as Lowercase<LeadBand>] }),
  );

  return (
    <div className="page-enter mx-auto max-w-6xl">
      <section className="property-hero rounded-3xl border border-white/10 px-6 py-8 shadow-2xl lg:px-9">
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Your acquisition command center</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Find momentum. <span className="text-cyan-300">Close smarter.</span></h1>
          <p className="mt-2 text-sm leading-6 text-slate-200">A live view of the sellers and opportunities that deserve your next move.</p>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="glass-card metric-card rounded-2xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Leads
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
            {stats.total}
          </p>
        </div>
        {bandCards.map((card) => (
          <div
            key={card.band}
            className="glass-card metric-card rounded-2xl p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {card.band}
            </p>
            <p
              className={`mt-2 text-3xl font-semibold tabular-nums ${bandTint[card.band]}`}
            >
              {card.value}
            </p>
          </div>
        ))}
        <div className="glass-card metric-card rounded-2xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Appointments
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.appointments}
          </p>
        </div>
      </div>

      <div className="glass-card mt-8 rounded-3xl p-6 text-sm text-slate-300">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-cyan-200">Next best move</p>
        <p className="mt-2">Open a high-intent lead, start a seller conversation, then use the Deal Analyzer before you make an offer.</p>
      </div>
    </div>
  );
}
