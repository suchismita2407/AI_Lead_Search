/**
 * DealFlow AI — pricing page (/pricing).
 *
 * Full pricing section: Starter / Pro / Investor+ with per-tier feature lists,
 * the founding-customer banner, and per-tier CTAs that go to /login. Payments
 * are not live yet, so there are NO checkout buttons — the call to action is
 * signing up free, with an honest note that payment setup is coming online.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PublicFooter,
  PublicHeader,
} from "~/components/public-header";
import { PLANS, formatUsd } from "~/lib/plans";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="app-shell min-h-dvh text-white">
      <PublicHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold tracking-[.18em] text-cyan-300">SIMPLE, SERIOUS PRICING</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Start with 3 days. Stay when it pays for itself.</h1>
            <p className="mt-4 text-lg text-slate-300">
              Your trial includes up to 10 leads. Choose a plan after three days to keep your workspace and unlock higher limits.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-center dark:border-blue-900 dark:bg-blue-950/50">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Founding-customer offer: the first 10 customers get $29/month
              locked for 12 months — on any plan.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PLANS.map((tier) => (
              <div
                key={tier.name}
                className={`glass-card relative flex flex-col rounded-3xl p-7 ${
                  tier.highlighted
                    ? "border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-500"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h2 className="text-base font-semibold text-white">
                  {tier.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tier.blurb}
                </p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-white">
                    {formatUsd(tier.monthlyUsd)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    /month
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300"
                    >
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`mt-7 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? "ai-button text-white"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  Start 3-day trial
                </Link>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-gray-500 dark:text-gray-400">
            Trial access ends automatically after three days. Checkout activates once your payment provider is connected.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
