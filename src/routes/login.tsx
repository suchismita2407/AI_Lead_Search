import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { loginUser, registerUser, requestPasswordReset } from "~/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Sign in" }],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res =
        mode === "signin"
          ? await loginUser({ data: { email, password } })
          : await registerUser({ data: { name, email, password, company } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ("requiresVerification" in res && res.requiresVerification) {
        setNotice("Check your inbox to verify your email, then sign in.");
        setMode("signin");
        return;
      }
      await router.invalidate();
      await router.navigate({ to: "/app/dashboard" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setError(
        message.includes("DATABASE_URL")
          ? "The local database is not configured yet. Add DATABASE_URL and SESSION_SECRET to a .env file, then restart the server."
          : "We could not complete that request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try { await requestPasswordReset({ data: { email } }); setNotice("If an account exists, a password-reset link has been sent."); setForgot(false); }
    catch { setError("Password reset email is not available yet. Contact support or configure Resend."); }
    finally { setBusy(false); }
  }

  const inputCls = "premium-input w-full rounded-xl border px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none";

  return (
    <main className="app-shell relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <Link to="/" className="absolute left-5 top-5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 backdrop-blur hover:bg-white/10">← Back to home</Link>
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-blue-600 dark:text-blue-400"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-lg font-semibold tracking-tight text-white">DealFlow <span className="text-cyan-300">AI</span></span>
        </div>

        <div className="glass-card rounded-3xl p-6 shadow-2xl">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(
              [
                ["signin", "Sign in"],
                ["signup", "Create account"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === value
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {forgot ? <form onSubmit={onForgotPassword} className="space-y-4"><h2 className="text-lg font-bold text-white">Reset your password</h2><p className="text-sm text-slate-400">Enter your email and we’ll send a secure reset link.</p><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />{error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}<button disabled={busy} className="ai-button w-full rounded-xl px-3 py-3 text-sm font-bold text-white">{busy ? "Sending…" : "Send reset link"}</button><button type="button" onClick={() => setForgot(false)} className="w-full text-sm text-cyan-300 hover:text-cyan-100">Back to sign in</button></form> : <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="Jane Investor"
                  />
                </div>
                <div>
                  <label
                    htmlFor="company"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Company{" "}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={inputCls}
                    placeholder="Acme Capital LLC"
                  />
                </div>
              </>
            )}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder={
                  mode === "signin" ? "••••••••" : "At least 8 characters"
                }
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
              >
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="ai-button w-full rounded-xl px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
            {mode === "signin" ? <button type="button" onClick={() => { setForgot(true); setError(null); setNotice(null); }} className="w-full text-sm font-medium text-cyan-300 hover:text-cyan-100">Forgot password?</button> : null}
          </form>}
        </div>

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          New accounts receive a limited 3-day trial after email verification.
        </p>
      </div>
    </main>
  );
}
