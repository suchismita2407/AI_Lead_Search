import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/campaigns")({
  component: CampaignsPage,
});

function CampaignsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Campaigns
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Launch and track outreach campaigns for your lead lists.
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        No campaigns yet. Outreach (SMS/email) becomes available once the core
        pipeline is live.
      </div>
    </div>
  );
}