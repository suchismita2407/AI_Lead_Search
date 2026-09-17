# Production checklist

DealFlow AI now uses Node.js and PostgreSQL. Do not deploy with an empty
`DATABASE_URL`, a development session secret, or without email delivery.

## Required accounts and environment variables

1. Create a pooled Postgres database at Neon or Supabase and set `DATABASE_URL`.
2. Generate a random `SESSION_SECRET` of 32+ characters and set the canonical
   HTTPS `APP_URL`.
3. Verify a sending domain at Resend and set `RESEND_API_KEY` and `EMAIL_FROM`.
4. Configure `GROQ_API_KEY` and `AI_PROVIDER=groq` for low-cost live AI replies,
   or set `AI_PROVIDER=openai` with `OPENAI_API_KEY`. The app remains in clearly
   labelled simulation mode when no provider key is set.
5. Create and verify a Dodo Payments merchant account before enabling billing.
   Create monthly USD subscription products and set the three product IDs in
   Vercel. Never put Dodo, database, OpenAI, or Resend secrets in client code.

## Vercel

Import the GitHub repository into a Vercel Pro project, add the variables above
to Production and Preview, and deploy. `npm run build:vercel` writes Vercel's
Build Output API bundle. Add your purchased domain in Vercel's Domains settings,
then configure the DNS record Vercel shows and wait for SSL verification.

## Payments

Use Dodo Payments as the merchant of record for USD subscriptions. Its hosted
checkout returns a checkout URL for a configured USD product. Only activate a
plan after a verified, idempotently stored webhook event; never trust a browser
redirect as payment proof. Configure the webhook as HTTPS and verify the
Standard Webhooks signature against the raw request body.

## Lead-data compliance

This application accepts client-owned CSV data. A real lead-data source must be
chosen and contracted by the business before integration. Store source, consent,
suppression/opt-out, and lawful-use metadata; enforce regional outreach rules
and have counsel review the workflow before contacting sellers.
