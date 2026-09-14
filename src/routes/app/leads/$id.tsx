import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/leads/$id")({
  component: LeadDetailPage,
});

function LeadDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/leads"
        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        ← Back to Leads
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Lead Detail
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        You are viewing lead{" "}
        <span className="font-medium text-gray-900 dark:text-white">
          #{id}
        </span>
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Screening signals, qualification scores, conversation history and
        appointment booking for this lead land here with the lead pipeline
        milestone.
      </div>
    </div>
  );
}