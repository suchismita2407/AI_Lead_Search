import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { getCurrentUser, getWorkspaceAccess, logoutUser, type SessionUser } from "~/lib/auth";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    const access = await getWorkspaceAccess();
    if (!access?.allowed) throw redirect({ to: "/pricing" });
    return { user, access };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext() as unknown as {
    user: SessionUser;
  };
  const { access } = Route.useRouteContext() as unknown as { access: { status: string; trialEndsAt: string | null } };
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
    { to: "/app/dashboard", label: "Dashboard", icon: "◈" },
    { to: "/app/leads", label: "Leads", icon: "⌘" },
    { to: "/app/campaigns", label: "Campaigns", icon: "◎" },
    { to: "/app/analyzer", label: "Deal Analyzer", icon: "✦" },
    { to: "/app/settings", label: "Settings", icon: "⚙" },
  ] as const;

  const linkCls =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/7 hover:text-white";
  const linkActiveCls =
    "bg-gradient-to-r from-cyan-400/15 to-violet-500/15 text-white ring-1 ring-inset ring-white/8";

  return (
    <div className="app-shell flex min-h-dvh">
      <aside className="app-sidebar flex w-64 shrink-0 flex-col border-r border-white/8">
        <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/8 px-5">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 rounded-xl bg-cyan-400/10 p-1.5 text-cyan-300 ring-1 ring-cyan-300/20"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-base font-bold tracking-tight text-white">DealFlow <span className="text-cyan-300">AI</span></span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {access.status === "trial" ? <div className="mb-3 rounded-xl border border-amber-300/15 bg-amber-300/8 px-3 py-2 text-xs text-amber-100"><span className="font-bold">3-day trial</span><br />Limited to 10 leads · {access.trialEndsAt ? `ends ${new Date(access.trialEndsAt).toLocaleDateString()}` : ""}</div> : null}
          {access.status === "admin" ? <div className="mb-3 rounded-xl border border-cyan-300/15 bg-cyan-300/8 px-3 py-2 text-xs font-bold text-cyan-100">Admin workspace · full access</div> : null}
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={linkCls}
              activeProps={{ className: `${linkCls} ${linkActiveCls}` }}
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/5 text-xs text-cyan-200">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>

        <div className="m-3 shrink-0 rounded-2xl border border-white/8 bg-white/4 p-3">
          <p className="truncate text-sm font-medium text-white">
            {user.name}
          </p>
          <p className="truncate text-xs text-slate-400">
            {user.email}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="app-main flex-1 overflow-y-auto p-5 lg:p-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
