# Temple Initiative — Say Yes to Vegan Sugar

Temple Initiative is a public-awareness website. Its current campaign, Say Yes to Vegan Sugar, helps temple communities check sugar-processing information, make informed choices, and share awareness. Donation requests are secondary and reviewed individually.

This is **not** an online store. No checkout, payments, fundraising targets, or tax-deduction claims.

## Stack

- Next.js 15 App Router · TypeScript (strict) · Tailwind CSS
- PostgreSQL + Drizzle ORM (committed SQL migrations)
- Zod + React Hook Form (validation)
- Auth.js v5 (NextAuth beta) with Google sign-in for administrators
- Vitest (unit) + Playwright (browser flows)

## Local development

Requirements: Node.js 20.18+ (see `engines`), PostgreSQL 15+.

```bash
npm ci
cp .env.example .env
# Edit .env: DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ADMIN_EMAILS, NEXT_PUBLIC_SITE_URL
```

Start a local Postgres (example with Docker):

```bash
docker run --name vegansugar-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vegansugar -p 5432:5432 -d postgres:16
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vegansugar
```

Apply migrations (committed SQL in `./drizzle`):

```bash
npm run db:migrate
```

Generate a new migration after editing `lib/schema.ts`:

```bash
npm run db:generate
```

Run the app:

```bash
npm run dev      # http://localhost:3000
npm run typecheck
npm run lint
npm run test     # vitest
npm run test:e2e # playwright (starts dev server automatically)
npm run build && npm start
```

## Railway deployment (production target)

Railway is the production host. Do **not** deploy via Vercel.

### Expected service configuration

- **Web service**: Dockerfile build (this repo includes a `Dockerfile`). Root directory = repo root.
- **Database**: Railway PostgreSQL plugin. It injects `DATABASE_URL` into the web service.
- **Pre-deploy command** (run migrations before each deploy): `npm run db:migrate`
  - Requires `DATABASE_URL` at deploy time.
  - The migration runner (`lib/migrate.ts`) is bundled in the production image (`tsx`, `drizzle-orm`, `pg` are runtime deps), so the command works in the final image.
  - Do not run `db:generate`, `db push`, seeds, or per-request migrations in production.
- **Health check**: `GET /api/health` (liveness, no DB, no secrets).
  - Do **not** use `/api/ready` as the deployment health check: it returns 503 when the database is unreachable, which can cause restart loops during DB maintenance. Use `/api/ready` separately to verify readiness after deploy.
- **Start command**: `node server.js` (Next.js standalone output; listens on Railway's `PORT`, honors `HOSTNAME`).

### Environment variables (Railway → Service → Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Injected by Railway Postgres plugin. Never commit it. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Admin sessions fail closed without it. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | yes | Google Cloud OAuth client. Authorized redirect URI: `https://<your-domain>/api/auth/callback/google` |
| `ADMIN_EMAILS` | yes | Comma-separated allowlist, e.g. `admin@example.org,second@example.org` |
| `NEXT_PUBLIC_SITE_URL` | yes (**build-time**: changing it requires a **rebuild**) | Canonical URL, no trailing slash, e.g. `https://say-yes.example.org`. Set after the public domain is known; rebuild after changing it (sitemap, OG, callbacks). The Dockerfile accepts it as a build arg (defaults to `http://localhost:3000`). |
| `AUTH_TRUST_HOST` | default `true` | Leave `true` on Railway so Auth.js honors the proxied host. |
| `NEXT_PUBLIC_SENTRY_DSN` | no (**build-time**; see error-monitoring section) | Sentry DSN for browser + server error events. Set as a build-time variable, then rebuild. |

Railway supplies `PORT`; do not hardcode one. No `NEXT_*` build-time secrets are needed: public pages build without `DATABASE_URL`.

### Verify after deploy

1. `GET https://<domain>/api/health` → `{"status":"ok",...}`
2. `GET https://<domain>/api/ready` → `{"status":"ready"}` (503 = DB not connected)
3. Google sign-in at `/admin/signin` works for an allowlisted email; non-allowlisted Google accounts see Access Denied; signed-out users see Access Denied at `/admin`.
4. Submit a test donation request, support offer, and contact message; confirm they appear in `/admin`.
5. Delete test records before announcing the launch.

### Backups

Railway PostgreSQL has its own backup/restore tooling. Confirm the backup schedule and test a restore procedure with the operator — this repo does not claim backups are enabled.

## Error monitoring (Sentry, optional)

Unexpected production errors are reported to Sentry (SDK `@sentry/nextjs@11.16.0`).
The integration is privacy-conscious and entirely optional: with no DSN
configured, monitoring is silent and the app behaves identically.

### What is monitored

- Unhandled errors from Server Components, route handlers, server actions,
  and middleware (via `instrumentation.ts` → `onRequestError`), plus the App
  Router `app/global-error.tsx` boundary and browser errors.
- Handled failures in critical operations as sanitized operation-level events
  (fixed message, safe tags only): `donation_request_create`,
  `support_offer_create`, `contact_inquiry_create`, `admin_request_status_update`.

### What is NOT enabled or sent

- Session Replay, performance tracing, profiling, user feedback, console/log
  forwarding, and user identification are all disabled.
- Collection is restricted via shared options in `lib/sentry.ts`
  (`maxBreadcrumbs: 0` plus `dataCollection` with `userInfo`, `cookies`,
  `httpHeaders`, `urlQueryParams`, and friends off).
- A second layer (`lib/sentry-sanitize.ts`, wired via `beforeSend`) deletes
  request bodies/cookies/headers, user identity, query strings, extras, and
  unknown tags, keeping only the method, clean URL, and `operation`/`route`
  tags.
- Raw DB exceptions are never attached (they may contain SQL, connection info,
  or submitted values). Expected failures (validation 422, auth 401, rate
  limit 429, DB-unavailable 503) never create events.

This is defense in depth, not a guarantee: review actual event payloads in
Sentry before public launch (see verification below).

### Configuration

| Variable | Build-time or runtime | Notes |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | **build-time** (inlined into the browser bundle) | Where events are sent. Get it from Sentry → project Settings → Client Keys (DSN). The server SDK reads the same variable at runtime. Leave unset for local dev. |
| `SENTRY_ORG` / `SENTRY_PROJECT` | build-time | Only needed when source-map uploads are enabled (they are currently disabled). |
| `SENTRY_AUTH_TOKEN` | never in image | Privileged upload token. Only needed for future source-map uploads; never prefix with `NEXT_PUBLIC_`, never commit, never pass via Docker ARG/ENV. |
| `SENTRY_TEST_ENABLED` | runtime | `true` only to show the temporary admin-only synthetic test button. Unset afterward. |

DSN vs token: the DSN only *receives* error events (safe to expose in the
browser bundle); the auth token can *upload/manage* project artifacts (secret).

### Setup (operator)

1. Create a **Sentry Next.js** project (free tier is fine; no paid features used).
2. Copy its DSN.
3. On Railway, set `NEXT_PUBLIC_SENTRY_DSN` as a **build-time** variable
   (or in the build environment), then **rebuild/redeploy** — changing the DSN
   requires a rebuild because it is inlined into client JS.
4. Verify: set `SENTRY_TEST_ENABLED=true`, redeploy, sign in as admin, open
   `/admin`, send the synthetic test event, confirm it in Sentry → Issues.
5. Open the event and confirm: no names, emails, cookies, bodies, query
   strings, or record identifiers — only the fixed message plus
   `operation`/`route` tags.
6. In Sentry project settings, configure server-side scrubbing rules,
   alert routing, access, retention, and (if desired) the data region — these
   are account-side and cannot be set from code.
7. Unset `SENTRY_TEST_ENABLED` and redeploy to remove the test button.

### Source maps (deferred)

Readable production stack traces need source-map uploads, but token security
comes first. Uploads are currently **disabled** (`sourcemaps: { disable:
"disable-upload" }` in `next.config.mjs`), so builds never require
`SENTRY_AUTH_TOKEN` and never fail when it is absent. Browser `.map` files are
not publicly served (`productionBrowserSourceMaps` stays unset). Do not claim
uploads are verified. Enabling uploads later requires `SENTRY_ORG` /
`SENTRY_PROJECT` plus a securely-injected `SENTRY_AUTH_TOKEN`, a matching
release identifier, and a verification that uploaded maps match the deployed
artifacts.

### Local behavior

- No DSN → `Sentry.init({ enabled: false })` on both runtimes; zero delivery
  attempts; `reportHandledError` is a no-op. Public pages, forms, auth,
  migrations, and builds do not depend on Sentry availability.

## Database

Tables: `donation_requests`, `request_notes`, `request_status_history`, `support_offers`, `contact_inquiries`, `rate_limits` (persistent), `outreach_prospects` (initially empty; no seed data).

- Internal UUID primary keys + opaque public refs (`SVS-XXXX-XXXX`, `SUP-…`, `CON-…`).
- Idempotency keys (unique) prevent duplicate rows on retries.
- Status changes + history writes run in a transaction with admin email + timestamp.
- Bounded pagination everywhere; indexes on status, created_at, state.
- Connection pool: `pg` Pool, max 10, 10s connect timeout.

Migration workflow:

```bash
npm run db:generate   # local only, after schema edits; commit the SQL
npm run db:migrate    # local + Railway pre-deploy; applies ./drizzle
```

To verify a running instance's `DATABASE_URL` end to end, run the read-only
smoke check. It sends exactly two `GET`s (`/api/ready` and `/temples`) and
writes nothing — no submissions, no test records:

```bash
npm run smoke:db -- https://<domain>
# or against a local server:
SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:db
```

It exits non-zero if `/api/ready` is not `200 {"status":"ready"}`, or if
`/temples` renders its "database temporarily unavailable" fallback — that
page returns HTTP 200 even when the database is down, so the marker is the
real assertion.

## Security & launch hardening

Implemented: server-side Zod validation, persistent rate limiting (10 req/hr/IP for donation requests, 20/hr for support/contact), honeypot fields, 32–64 KB body limits, no `localStorage` PII, no PII in URLs, no public lookup endpoint, `private, no-store` on admin/API-admin, security headers (nosniff, DENY framing, referrer, CSP), fail-closed admin, generic public error messages (detailed DB errors only in server logs), `AUTH_TRUST_HOST` for Railway proxy handling (rate limiting uses `x-forwarded-for` only for bucketing, never for auth).

Tradeoffs / remaining work: no CAPTCHA yet (add if spam appears); file-upload-free (temple websites are never fetched server-side); session is JWT (8h); audit exports beyond the CSV are manual. See Launch Checklist below.

## Accessibility & performance

Semantic landmarks, skip link, labeled inputs + autocomplete, field errors + error summary, `aria-live` announcements, 44px+ targets, focus-visible rings, reduced-motion support, no color-only status. Server-rendered public pages, minimal JS (forms, accordion, menus), one self-hosted SVG OG image, no trackers.

## Launch checklist

- [ ] Runtime variables set (DATABASE_URL, AUTH_SECRET, Google ID/secret, ADMIN_EMAILS, NEXT_PUBLIC_SITE_URL, AUTH_TRUST_HOST=true)
- [ ] Database connected; `npm run db:migrate` applied via pre-deploy command
- [ ] Public domain + HTTPS verified; canonical site URL correct
- [ ] `/api/health` 200; `/api/ready` ready; `npm run smoke:db -- <url>` exits 0
- [ ] Google sign-in tested; allowlisted login works; non-allowlisted denied; signed-out denied
- [ ] Test donation request saved and visible to admin; test support + contact flows
- [ ] Rate limiting + failure states tested (429 page, 503 maintenance message)
- [ ] Test records removed
- [ ] Privacy/terms operator details finalized; educational claims reviewed
- [ ] Real review/fulfillment process confirmed with the team
- [ ] Backup arrangements confirmed; no secrets committed
- [ ] Sentry: DSN set + rebuilt (if used); synthetic event reviewed for sensitive data; test flag unset; account-side scrubbing/alerts/retention configured; source-map uploads explicitly deferred
