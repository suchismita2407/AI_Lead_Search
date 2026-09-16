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

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Pricing" }],
  }),
  component: PricingPage,
});

interface Tier {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  highlighted?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    price: "$299",
    blurb: "For investors getting their pipeline moving.",
    features: [
      "250 leads per month",
      "AI qualification",
      "Basic follow-up",
      "Dashboard & lead scoring",
      "CSV lead upload with dedupe",
    ],
  },
  {
    name: "Pro",
    price: "$799",
    blurb: "For active investors who want the full pipeline.",
    features: [
      "1,000 leads per month",
      "AI seller conversations",
      "Appointment booking",
      "Deal analysis",
      "Analytics",
      "CSV lead upload with dedupe",
    ],
    highlighted: true,
  },
  {
    name: "Investor+",
    price: "$1,499",
    blurb: "For investors running multiple campaigns.",
    features: [
      "2,500 leads per month",
      "Multiple campaigns",
      "Advanced qualification",
      "Priority support",
      "Multiple users",
      "Everything in Pro",
    ],
  },
];

function PricingPage() {
  return (
    <div className="min-h-dvh bg-white dark:bg-gray-950">
      <PublicHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              Pricing
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              One live product, three volume tiers. Every plan includes the full
              pipeline — scoring, AI conversations, qualification and booking.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-center dark:border-blue-900 dark:bg-blue-950/50">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Founding-customer offer: the first 5 customers get $299/month
              locked for 12 months — on any plan.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border bg-white p-7 shadow-sm dark:bg-gray-900 ${
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
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {tier.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tier.blurb}
                </p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {tier.price}
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
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  }`}
                >
                  Sign up free
                </Link>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-gray-500 dark:text-gray-400">
            Free to sign up today — payment setup is coming online soon, so
            there's no checkout and no card required. Your demo account works on
            every tier.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}