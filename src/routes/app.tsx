import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { getCurrentUser, logoutUser, type SessionUser } from "~/lib/auth";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext() as unknown as {
    user: SessionUser;
  };
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      await router.invalidate();
      await router.navigate({ to: "/login" });
    } finally {
      setSigningOut(false);
    }
  }

  const navItems = [
    { to: "/app/dashboard", label: "Dashboard" },
    { to: "/app/leads", label: "Leads" },
    { to: "/app/campaigns", label: "Campaigns" },
    { to: "/app/analyzer", label: "Deal Analyzer" },
    { to: "/app/settings", label: "Settings" },
  ] as const;

  const linkCls =
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100";
  const linkActiveCls =
    "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white";

  return (
    <div className="flex min-h-dvh bg-gray-50 dark:bg-gray-950">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-gray-200 px-5 dark:border-gray-800">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            DealFlow AI
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={linkCls}
              activeProps={{ className: `${linkCls} ${linkActiveCls}` }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 border-t border-gray-200 p-4 dark:border-gray-800">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {user.name}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {user.email}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}