import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Leads
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your seller lead list, scored and qualified. CSV upload and AI
        qualification arrive in the next milestone.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Lead
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Property
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Score
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            <tr>
              <td
                colSpan={4}
                className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                No leads yet. Upload a CSV to start qualifying sellers.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}