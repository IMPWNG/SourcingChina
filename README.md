# SourcingChina

Reviewed directory of Chinese motorcycle-industry suppliers: factories, trading companies, and brands. Subscribers search published company profiles. Editors upload business cards, check drafts, and publish them.

This is not a marketplace. Profiles do not show prices, stock, SKUs, stand numbers, hall names, or visit dates.

## Stack

- Next.js App Router, TypeScript, Tailwind, shadcn/ui
- Supabase Postgres with row level security, Supabase Auth via `@supabase/ssr` cookie sessions
- Card images in the private Supabase Storage bucket `card-images`
- Airwallex Hosted Payment Page plus a signed webhook (the product spec mentioned Stripe; this repo uses Airwallex)
- Narrow website enrichment with `fetch` + Cheerio, robots.txt, and a 10-page cap

Without Supabase keys the app runs in demo mode: sample companies, demo sign-in, and a checkout confirmation that does not charge a card.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123

Demo accounts (only when Supabase is not configured):

- `demo.subscriber@sourcingchina.example` / `demo-subscriber`
- `demo.admin@sourcingchina.example` / `demo-admin`

The subscriber starts without access. Pricing leads to a demo checkout that opens the directory for 30 days on this machine. The admin can upload the sample card, publish drafts, and run enrichment on Liangjiang Riding Apparel (`fixture://sample-supplier`).

```bash
npm test
npm run lint
```

## Environment

Copy `.env.example` to `.env.local`. Placeholders are not secrets. Leave them blank to stay in demo mode.

| Name | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key. Public by design. |
| `SUPABASE_SECRET_KEY` | Server only. Webhooks update subscriptions. Never use a `NEXT_PUBLIC_` name. |
| `AIRWALLEX_CLIENT_ID` | Server only. |
| `AIRWALLEX_API_KEY` | Server only. |
| `AIRWALLEX_WEBHOOK_SECRET` | Server only. HMAC key for `x-timestamp` + raw body. |
| `AIRWALLEX_ENV` | `demo` or `prod`. |
| `AIRWALLEX_PLAN_AMOUNT` | Charged amount in major units. Default `79`. The webhook refuses any other amount. |
| `AIRWALLEX_PLAN_CURRENCY` | Default `EUR`. |
| `AIRWALLEX_COUNTRY_CODE` | Shopper country for hosted checkout. Default `FR`. |
| `NEXT_PUBLIC_APP_URL` | Public origin. Airwallex success URLs must be `https`. |
| `ADMIN_EMAILS` | Comma-separated emails promoted to admin on sign-in. Requires the secret key. |
| `GOOGLE_VISION_API_KEY` | Optional. Document text detection for card images. |
| `DEMO_SESSION_SECRET` | Optional. Demo cookie HMAC. A local file is created if omitted. |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are accepted as legacy aliases.

## Supabase

1. Create a project.
2. Run `supabase/migrations/20260924120000_init.sql` in the SQL editor, or `supabase db push` if the CLI is linked.
3. Put the URL, publishable key, and secret key in `.env.local`.
4. In Authentication, enable email + password. Add `https://<your-domain>/auth/confirm` to the redirect allow list.
5. Promote an editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Or set `ADMIN_EMAILS` and sign in again.

Every public table has RLS. `companies.notes` is not selectable by `authenticated`; admins use `company_notes` / `set_company_notes`. `sources`, card images, and billing events are not readable by subscribers. The service-role key is used only on the server for webhook writes.

## Airwallex

1. Create a demo account and API keys.
2. Set `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_WEBHOOK_SECRET`, and `AIRWALLEX_ENV=demo`.
3. Register the webhook `https://<your-domain>/api/webhooks/airwallex` for `payment_intent.succeeded` and `refund.settled`.
4. Checkout creates a PaymentIntent for the server-side plan amount and redirects with Airwallex.js. The browser receives the intent id and client secret for that payment only.
5. Access is granted when the webhook signature checks out and the amount and currency match the plan. The return page does not grant access by itself.

A successful payment opens 30 days of directory access. Renewing before the period ends extends it. This is a checkout plus webhook, not Airwallex Billing auto-renew, until a Billing product is configured.

## Vercel

The app is a standard Next.js project (`vercel` deploy from this directory).

```bash
vercel link
vercel env pull .env.local
vercel deploy
```

Set the same env vars for Preview and Production. Do not mark the secret key, Airwallex API key, or webhook secret as public.

Webhook route needs the public URL. Point Airwallex at the deployment origin.

This environment did not have a Vercel login or a linked project, so production deploy is not done from here.

## Decisions

- Payments are Airwallex, not Stripe.
- Auth is Supabase Auth inside Next.js, not Clerk or Auth0.
- OCR without `GOOGLE_VISION_API_KEY` expects pasted card text or the sample card. Images are still stored.
- Enrichment proposes a patch. An editor applies it. Empty fields are filled; existing values are kept.
- Sample companies are fictional placeholders so the directory is usable before real cards are reviewed.
