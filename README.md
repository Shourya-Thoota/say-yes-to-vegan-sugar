# Say Yes to Vegan Sugar

A community initiative helping Hindu temples in the United States make informed decisions about sugar and request donated vegan sugar for prasadam, religious offerings, festivals, and community meals.

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
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical URL, no trailing slash, e.g. `https://say-yes.example.org`. Set after the public domain is known; redeploy after changing it (sitemap, OG, callbacks). |
| `AUTH_TRUST_HOST` | default `true` | Leave `true` on Railway so Auth.js honors the proxied host. |

Railway supplies `PORT`; do not hardcode one. No `NEXT_*` build-time secrets are needed: public pages build without `DATABASE_URL`.

### Verify after deploy

1. `GET https://<domain>/api/health` → `{"status":"ok",...}`
2. `GET https://<domain>/api/ready` → `{"status":"ready"}` (503 = DB not connected)
3. Google sign-in at `/admin/signin` works for an allowlisted email; non-allowlisted Google accounts see Access Denied; signed-out users see Access Denied at `/admin`.
4. Submit a test donation request, support offer, and contact message; confirm they appear in `/admin`.
5. Delete test records before announcing the launch.

### Backups

Railway PostgreSQL has its own backup/restore tooling. Confirm the backup schedule and test a restore procedure with the operator — this repo does not claim backups are enabled.

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

## Security & launch hardening

Implemented: server-side Zod validation, persistent rate limiting (10 req/hr/IP for donation requests, 20/hr for support/contact), honeypot fields, 32–64 KB body limits, no `localStorage` PII, no PII in URLs, no public lookup endpoint, `private, no-store` on admin/API-admin, security headers (nosniff, DENY framing, referrer, CSP), fail-closed admin, generic public error messages (detailed DB errors only in server logs), `AUTH_TRUST_HOST` for Railway proxy handling (rate limiting uses `x-forwarded-for` only for bucketing, never for auth).

Tradeoffs / remaining work: no CAPTCHA yet (add if spam appears); file-upload-free (temple websites are never fetched server-side); session is JWT (8h); audit exports beyond the CSV are manual. See Launch Checklist below.

## Accessibility & performance

Semantic landmarks, skip link, labeled inputs + autocomplete, field errors + error summary, `aria-live` announcements, 44px+ targets, focus-visible rings, reduced-motion support, no color-only status. Server-rendered public pages, minimal client JS (forms, accordion, menus), one self-hosted SVG OG image, no trackers.

## Launch checklist

- [ ] Runtime variables set (DATABASE_URL, AUTH_SECRET, Google ID/secret, ADMIN_EMAILS, NEXT_PUBLIC_SITE_URL, AUTH_TRUST_HOST=true)
- [ ] Database connected; `npm run db:migrate` applied via pre-deploy command
- [ ] Public domain + HTTPS verified; canonical site URL correct
- [ ] `/api/health` 200; `/api/ready` ready
- [ ] Google sign-in tested; allowlisted login works; non-allowlisted denied; signed-out denied
- [ ] Test donation request saved and visible to admin; test support + contact flows
- [ ] Rate limiting + failure states tested (429 page, 503 maintenance message)
- [ ] Test records removed
- [ ] Privacy/terms operator details finalized; educational claims reviewed
- [ ] Real review/fulfillment process confirmed with the team
- [ ] Backup arrangements confirmed; no secrets committed
