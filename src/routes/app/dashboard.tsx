import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

export const dashboardStats = createServerFn().handler(async () => {
  const { requireUser } = await import("~/lib/auth.server");
  const user = await requireUser();
  const [counts] = await sql()`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN lead_score BETWEEN 80 AND 100 THEN 1 ELSE 0 END), 0) AS hot,
      COALESCE(SUM(CASE WHEN lead_score BETWEEN 60 AND 79 THEN 1 ELSE 0 END), 0) AS warm,
      COALESCE(SUM(CASE WHEN lead_score BETWEEN 40 AND 59 THEN 1 ELSE 0 END), 0) AS nurture,
      COALESCE(SUM(CASE WHEN lead_score < 40 THEN 1 ELSE 0 END), 0) AS low
    FROM leads
    WHERE user_id = ${user.id}
  `;
  const [appts] = await sql()`
    SELECT COUNT(*) AS total
    FROM appointments a
    JOIN leads l ON l.id = a.lead_id
    WHERE l.user_id = ${user.id}
  `;
  return {
    total: Number(counts?.total ?? 0),
    hot: Number(counts?.hot ?? 0),
    warm: Number(counts?.warm ?? 0),
    nurture: Number(counts?.nurture ?? 0),
    low: Number(counts?.low ?? 0),
    appointments: Number(appts?.total ?? 0),
  };
});

export const Route = createFileRoute("/app/dashboard")({
  loader: async () => dashboardStats(),
  component: Dashboard,
});

function Dashboard() {
  const stats = Route.useLoaderData();
  const cards = [
    { label: "Leads", value: stats.total, tint: "text-gray-900 dark:text-white" },
    { label: "HOT", value: stats.hot, tint: "text-red-600 dark:text-red-400" },
    { label: "WARM", value: stats.warm, tint: "text-amber-600 dark:text-amber-400" },
    { label: "NURTURE", value: stats.nurture, tint: "text-blue-600 dark:text-blue-400" },
    { label: "LOW", value: stats.low, tint: "text-gray-500 dark:text-gray-400" },
    { label: "Appointments", value: stats.appointments, tint: "text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Pipeline snapshot for your seller leads. Counts come straight from your
        lead database — they will fill in once leads are uploaded.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${card.tint}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Coming next: CSV lead upload, lead scoring, and the AI seller
        conversation pipeline.
      </div>
    </div>
  );
}