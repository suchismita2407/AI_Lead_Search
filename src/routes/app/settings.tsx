import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { getSettings, saveSettings } from "~/lib/settings";
import type { UserSettings } from "~/lib/settings";
import type { SessionUser } from "~/lib/auth";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Settings" }],
  }),
  loader: async () => getSettings(),
  component: SettingsPage,
});

const FIELDS: ReadonlyArray<{
  key: keyof UserSettings;
  label: string;
  type: "text" | "textarea";
  placeholder?: string;
  hint?: string;
}> = [
  { key: "business_name", label: "Business name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "business_email", label: "Email", type: "text" },
  { key: "calendar", label: "Calendar", type: "text" },
  { key: "messaging", label: "Messaging", type: "text" },
  {
    key: "ai_instructions",
    label: "AI instructions",
    type: "textarea",
    hint: "Instructions the AI seller agent follows — e.g. \"Buy in Detroit, prefer vacant properties\".",
  },
];

function SettingsPage() {
  const initial = Route.useLoaderData();
  const { user } = Route.useRouteContext() as unknown as {
    user: SessionUser;
  };
  const [values, setValues] = useState<UserSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: keyof UserSettings, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await saveSettings({ data: { settings: values } });
      if ("error" in res) {
        setError(res.error);
      } else {
        setValues(res.settings);
        setSaved(true);
      }
    } catch {
      setError("Couldn't save settings. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Settings
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your account, workspace preferences, and how the AI seller agent
        behaves for you.
      </p>

      {/* Account summary (read-only) */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <dl className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-gray-500 dark:text-gray-400">Name</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {user.name}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-gray-500 dark:text-gray-400">Account email</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {user.email}
            </dd>
          </div>
        </dl>
      </div>

      {/* Workspace settings form */}
      <form
        onSubmit={handleSave}
        className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Workspace
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          How you want to be reached, and how the AI seller agent should work
          for you.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label
              key={field.key}
              className={
                field.type === "textarea" ? "sm:col-span-2" : undefined
              }
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {field.label}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  value={values[field.key]}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  rows={4}
                  maxLength={2000}
                  aria-label={field.label}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              ) : (
                <input
                  type="text"
                  value={values[field.key]}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  aria-label={field.label}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              )}
              {field.hint ? (
                <span className="mt-1.5 block text-xs text-gray-400 dark:text-gray-500">
                  {field.hint}
                </span>
              ) : null}
            </label>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
          {saved && (
            <span
              role="status"
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              ✓ Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}