/**
 * DealFlow AI — landing page (the public marketing front door).
 *
 * Replaces the old root redirect-to-login: the root URL now presents the
 * product — hero, product metrics, the 6-step pipeline (#product), a pricing
 * teaser and a final CTA. Sign in / Sign up both go to /login; the auth'd
 * product screens under /app/* are untouched.
 *
 * The public page never exposes customer metrics or private workspace data.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import {
  PublicFooter,
  PublicHeader,
} from "~/components/public-header";
import { PLANS, formatUsd } from "~/lib/plans";

/* ---------------------------------------------------------------------- */
/* Product metrics are intentionally not exposed from customer data.       */
/* ---------------------------------------------------------------------- */

export interface LiveMetrics {
  leads: number;
  hot: number;
  warm: number;
  nurture: number;
  low: number;
  conversations: number;
  qualified: number;
  appointments: number;
}

export const liveMetrics = createServerFn().handler(async () => {
  return {
    leads: 0, hot: 0, warm: 0, nurture: 0, low: 0,
    conversations: 0, qualified: 0, appointments: 0,
  } satisfies LiveMetrics;
});

/* ---------------------------------------------------------------------- */
/* Route                                                                   */
/* ---------------------------------------------------------------------- */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "DealFlow AI — Turn seller leads into qualified conversations and booked calls",
      },
    ],
  }),
  loader: async () => liveMetrics(),
  component: LandingPage,
});

/* ---------------------------------------------------------------------- */
/* Inline icons (stroke SVGs, no external assets)                          */
/* ---------------------------------------------------------------------- */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Sections                                                                */
/* ---------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle background grid — pure CSS, no images. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] dark:bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-24 sm:pt-28">
        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live now — this is the working product, not a mockup
        </p>

        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl dark:text-white">
          Turn seller leads into qualified conversations and booked calls
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-300">
          Upload your seller lead CSV. DealFlow AI scores every property from
          screening signals, and an AI agent talks to the sellers who respond —
          so the only calls you take are from sellers who are ready to sell.
        </p>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Screening signals, not claims. And the AI never makes offers, never
          states prices and never books a call for you — you stay in control.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
          >
            Start your free trial
          </Link>
          <Link
            to="/pricing"
            className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            See pricing
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Free trial · Upload your own CSV · Set up in minutes
        </p>
      </div>
    </section>
  );
}

function LiveToday({ metrics }: { metrics: LiveMetrics }) {
  const tiles = [
    { label: "Leads scored", value: metrics.leads, sub: `HOT ${metrics.hot} · WARM ${metrics.warm} · NURTURE ${metrics.nurture} · LOW ${metrics.low}` },
    { label: "AI conversations", value: metrics.conversations, sub: "started with sellers" },
    { label: "Sellers qualified", value: metrics.qualified, sub: "scored /25 by the AI" },
    { label: "Calls booked", value: metrics.appointments, sub: "by the investor" },
  ];

  return (
    <section className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Your lead pipeline, in one place
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Create your workspace to score and manage your first leads.
          </p>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t.label}
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {t.value}
              </dd>
              <dd className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t.sub}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const steps: Array<{ n: string; title: string; caption: string; icon: ReactNode }> = [
  {
    n: "01",
    title: "Upload your seller lead CSV",
    caption:
      "Drop in your property list — owner, address, value, condition. A sample file is included, and re-uploading updates instead of duplicating.",
    icon: (
      <Icon>
        <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </Icon>
    ),
  },
  {
    n: "02",
    title: "Every lead is scored",
    caption:
      "Seven screening signals — ownership length, equity, vacancy, condition, distress, absentee owner, listing withdrawal — become a 0–100 score and a HOT / WARM / NURTURE / LOW band. Labeled signals, not claims.",
    icon: (
      <Icon>
        <path d="M12 3l1.9 4.6 4.9.4-3.7 3.2 1.1 4.8L12 13.5 7.8 16l1.1-4.8L5.2 8l4.9-.4L12 3z" />
      </Icon>
    ),
  },
  {
    n: "03",
    title: "AI starts the conversation",
    caption:
      "When a seller responds, the AI agent keeps the thread natural and moving — no scripts, no spam, and no offers or prices quoted. Ever.",
    icon: (
      <Icon>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </Icon>
    ),
  },
  {
    n: "04",
    title: "Sellers are qualified /25",
    caption:
      "Motivation, timeline, condition, price flexibility and contactability — each scored 0–5 for a /25 total that grows as the conversation does.",
    icon: (
      <Icon>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </Icon>
    ),
  },
  {
    n: "05",
    title: "Qualified sellers come to you",
    caption:
      "Hot leads land in your dashboard with a BOOK CALL button. You book the appointment — the AI hands off, it never books for you.",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </Icon>
    ),
  },
  {
    n: "06",
    title: "Analyzer checks the deal",
    caption:
      "Run the numbers — ARV, rehab, holding and selling costs, ROI and a deal score. A useful estimate, not a guarantee.",
    icon: (
      <Icon>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 10h5M8 14h8M8 18h4" />
      </Icon>
    ),
  },
];

function HowItWorks() {
  return (
    <section id="product" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            From CSV to booked call — in six steps
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            The whole pipeline is built and running today. This is what happens
            the moment you upload your leads.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  {step.icon}
                </span>
                <span className="text-xs font-semibold tracking-widest text-gray-300 dark:text-gray-600">
                  {step.n}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {step.caption}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Simple pricing for a serious pipeline
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Every plan runs the same live product. Pick the volume that fits
            your month.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-center dark:border-blue-900 dark:bg-blue-950/50">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Founding-customer offer: the first 10 customers get $29/month locked
            for 12 months — on any plan.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((tier) => (
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
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {tier.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {tier.blurb}
              </p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
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
                to="/pricing"
                className={`mt-7 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                See full pricing
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-gray-950 dark:bg-black">
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-24">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Sign up and run it on your own leads
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
          Create your workspace, upload a CSV, and start organizing your seller
          conversations. No setup call required.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-block rounded-lg bg-blue-500 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-400"
        >
          Start your free trial
        </Link>
      </div>
    </section>
  );
}

function LandingPage() {
  const metrics = Route.useLoaderData();
  return (
    <div className="min-h-dvh bg-white dark:bg-gray-950">
      <PublicHeader />
      <main>
        <Hero />
        <LiveToday metrics={metrics} />
        <HowItWorks />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <PublicFooter />
    </div>
  );
}
