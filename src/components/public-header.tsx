/**
 * DealFlow AI — public marketing site chrome (landing + pricing).
 *
 * `PublicHeader`: sticky top bar with wordmark, Product/Pricing nav, and
 * Sign in / Sign up buttons (both go to /login, which has the tabs). The nav
 * collapses into a hamburger menu below `md` so the marketing pages stay
 * usable on phones.
 *
 * `PublicFooter`: one-line tagline + copyright.
 *
 * Both are shared by src/routes/index.tsx (landing) and src/routes/pricing.tsx.
 */
import { Link } from "@tanstack/react-router";
import { useState } from "react";

/** DealFlow AI wordmark (globe mark matches the signed-in app shell). */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 text-blue-600 dark:text-blue-400 ${
          compact ? "h-5 w-5" : "h-7 w-7"
        }`}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
      <span
        className={`font-semibold tracking-tight text-gray-900 dark:text-white ${
          compact ? "text-sm" : "text-lg"
        }`}
      >
        DealFlow AI
      </span>
    </span>
  );
}

const navLinkCls =
  "rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100";
const ghostBtnCls =
  "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";
const primaryBtnCls =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700";

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="DealFlow AI home">
          <Wordmark />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <a href="/#product" className={navLinkCls}>
            Product
          </a>
          <Link to="/pricing" className={navLinkCls}>
            Pricing
          </Link>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className={ghostBtnCls}>
            Sign in
          </Link>
          <Link to="/login" className={primaryBtnCls}>
            Sign up
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {menuOpen ? (
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-2 md:hidden dark:border-gray-800 dark:bg-gray-950">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            <a
              href="/#product"
              className={navLinkCls}
              onClick={() => setMenuOpen(false)}
            >
              Product
            </a>
            <Link
              to="/pricing"
              className={navLinkCls}
              onClick={() => setMenuOpen(false)}
            >
              Pricing
            </Link>
          </nav>
          <div className="mt-3 flex gap-2">
            <Link
              to="/login"
              className={`${ghostBtnCls} flex-1 text-center`}
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className={`${primaryBtnCls} flex-1 text-center`}
              onClick={() => setMenuOpen(false)}
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Wordmark compact />
          <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
            Turn seller leads into qualified conversations and booked calls.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} DealFlow AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}