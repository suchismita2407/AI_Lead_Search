import { createFileRoute } from "@tanstack/react-router";
import type { SessionUser } from "~/lib/auth";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  // /app/ beforeLoad guarantees a session and puts the user in route context.
  const { user } = Route.useRouteContext() as unknown as {
    user: SessionUser;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Settings
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your account and workspace preferences.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <dl className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-gray-500 dark:text-gray-400">Name</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{user.name}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-gray-500 dark:text-gray-400">Company</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {user.company || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Profile editing, notification preferences and AI agent configuration
        arrive in later milestones.
      </div>
    </div>
  );
}