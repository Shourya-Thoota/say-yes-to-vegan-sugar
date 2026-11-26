# Temple Initiative — Operations Runbook

Scope: **Say Yes to Vegan Sugar** production operations.
Read-only audit baseline: `origin/main` at `224c80b` (verified 2026-11-26).
This document describes implemented behavior with code references. It does
not change production, enable payments, send test events, or restore backups.
Anything marked **UNVERIFIED** or **OWNER-CONFIRM** requires explicit operator
approval before action. No schedules, contacts, retention periods, or restore
results are invented here.

Related code paths are cited so a future reader can re-verify them. Do not
treat passing automated tests as proof of production settings.

---

## 1. Service identification (no secrets)

- Repository: `Shourya-Thoota/temple-initiative`
- Campaign: Say Yes to Vegan Sugar
- Host: Railway (production target; do not deploy via Vercel)
- Web service: Dockerfile build, repo root. Standalone output (`output:
  "standalone"` in `next.config.mjs`), start command `node server.js`.
  Listens on Railway-provided `PORT`, honors `HOSTNAME`.
- Database: Railway PostgreSQL plugin, injects `DATABASE_URL` into web
  service. No checked-in connection strings.
- Expected Railway settings (from `README.md` + `.env.example` +
  `Dockerfile`, not from observed dashboard):
  - Pre-deploy command: `npm run db:migrate` (requires `DATABASE_URL`).
  - Health check: `GET /api/health`.
  - Do not use `/api/ready` as deploy health check (503 during DB
    maintenance can cause restart loops).
  - Build args: `NEXT_PUBLIC_SITE_URL` (required, rebuild on change),
    `NEXT_PUBLIC_SENTRY_DSN` (optional, rebuild on change).
  - Runtime vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
    `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`,
    `AUTH_TRUST_HOST=true`.

**OWNER-CONFIRM placeholders (unknown to this audit):**

- Railway project name / ID: `[OWNER: Railway project for Temple Initiative]`
- PostgreSQL service name / ID: `[OWNER: Postgres service name]`
- Production domain: `[OWNER: canonical domain, e.g. https://…]`
- Incident owner / on-call: `[OWNER: name + contact]`
- Admin allowlist owner: `[OWNER: who approves ADMIN_EMAILS changes]`
- Backup owner: `[OWNER: who owns backup schedule + restore approval]`

Never print or commit `DATABASE_URL`, `AUTH_SECRET`, Google secrets,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `SENTRY_AUTH_TOKEN`.

---

## 2. Health versus readiness (as implemented)

Source: `app/api/health/route.ts`, `app/api/ready/route.ts`, `lib/db.ts`.

- `GET /api/health` — liveness only. No DB, no secrets, no PII.
  Returns `{ status: "ok", service: "say-yes-to-vegan-sugar", time }`
  with `Cache-Control: no-store`. Use this for the Railway deployment
  health check.
- `GET /api/ready` — readiness. Checks `DATABASE_URL` presence
  (`isDbConfigured`) then `SELECT 1` via `checkDbReadable()`
  (10s connect timeout, pool max 10).
  - No `DATABASE_URL` → `503 { status: "not_ready", reason:
    "database_not_configured" }`.
  - DB unreachable → `503 { status: "not_ready", reason:
    "database_unreachable" }`.
  - Reachable → `200 { status: "ready", time }`.
  - Detailed DB errors are not exposed publicly; generic reasons only.
  Use `/api/ready` separately after deploy to verify readiness, never as
  the deploy health check.

---

## 3. Deployment and migration flow

Source: `Dockerfile`, `lib/migrate.ts`, `.github/workflows/ci.yml`,
`drizzle/meta/_journal.json`.

### 3.1 What deploys

- Image builds `builder` stage with `npm ci` + `npm run build`. Public
  pages build without runtime secrets.
- Runtime image (`runner`, non-root `nextjs`) contains: `.next/standalone`,
  `.next/static`, `public/`, `drizzle/` SQL + `lib/` migrator sources,
  `drizzle.config.ts`, `package.json`, production `node_modules`
  (includes `tsx`, `drizzle-orm`, `pg` so `npm run db:migrate` works).
- Migrations applied from committed SQL in `./drizzle` via
  `drizzle-orm/node-postgres` migrator. Current journal (4 entries):
  `0000_init`, `0001_public_temple_directory`,
  `0002_sponsorship_fulfillment`, `0003_sponsorship_hardening`.

### 3.2 Normal deploy order

1. Set/verify Railway variables (Section 1). Changing
   `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_SENTRY_DSN` requires rebuild.
2. Run pre-deploy: `npm run db:migrate` with production `DATABASE_URL`.
   Runner exits non-zero without `DATABASE_URL`; migration failure logs
   only `err.message`, never full connection string.
3. Deploy image, start `node server.js`.
4. Verify: `GET /api/health → 200`, then `GET /api/ready → 200`.
5. Verify admin sign-in (`/admin/signin`): allowlisted Google account
   succeeds; non-allowlisted sees Access Denied; signed-out `/admin`
   sees Access Denied.
6. Verify one donation-request + support + contact submission appears in
   `/admin` (see Section 9 for test-data cleanup gating).

### 3.3 Automated checks versus manual operating procedures

Automated (CI, `.github/workflows/ci.yml` on PR + `main` push, Postgres 18
service, `RUN_PG_TESTS=1`): `npm ci`, `typecheck`, `lint`,
`db:migrate` on test DB, `vitest run` (includes real-Postgres suites),
production `next build` with production site URL.

Manual (operator, not in CI): Railway variable review, pre-deploy
migration on production, health/ready checks on production domain,
Google OAuth allowlist test, backup inspection, Sentry payload review,
Stripe activation, takedown handling, test-data deletion. Passing CI
alone does not mean production is ready.

### 3.4 Application rollback versus database rollback

- Application rollback: redeploy the previous known-good image/commit
  via Railway. Safe because builds are stateless; no migration runs at
  image build time.
- Database rollback: there is **no automated down-migration**. `lib/migrate.ts`
  only applies forward. A schema change that added columns/tables cannot
  be undone by redeploying old code. Procedure:
  1. Stop further migrations.
  2. Assess whether old code is compatible with new schema (usually yes
     for additive changes; blocking for renames/drops — none present in
     current journal).
  3. If incompatible, restore into an **isolated** database first (Section
     4), verify, then plan a forward fix migration. Never edit production
     tables ad hoc without a reviewed migration.
- Staged-upgrade regression coverage exists
  (`tests/migration-staged-upgrade.test.ts`): journal order check plus
  staged migration tests. This guards migration ordering in CI; it is not
  a production rollback tool.

---

## 4. Backup inspection and isolated restore-drill procedure

Status: **UNVERIFIED** as of this audit.

Evidence: Railway dashboard/API was not accessible from this audit (no
Railway integration connected; only GitHub + Stripe integrations exist).
No backup schedule, retention window, or recent backup timestamp was
observed. A healthy `/api/ready` response does not prove backups exist.
Do not claim backups are enabled.

### 4.1 Inspection (read-only, operator performs)

1. Open Railway → Temple Initiative project → PostgreSQL service.
2. Record: backup schedule (frequency + time zone), retention period,
   storage location, last successful backup timestamp, last restore test
   date, and who is notified on failure.
3. Paste those values into the OWNER placeholders in Section 12; do not
   paste credentials or connection strings.

### 4.2 Restore drill — procedure only, DO NOT EXECUTE without separate approval

Approval gate: provisioning, restoring, or incurring cost requires
explicit operator approval naming the isolated target environment, data
handling owner, and cleanup owner. This runbook authorizes no restore.

1. Approve in writing: target isolated database/environment name, source
   backup timestamp, cost center, data handlers, and deletion date.
2. Provision a **separate isolated** Postgres database. Never restore over
   production. Treat restored data as sensitive production PII.
3. Restore the chosen backup into the isolated database only.
4. Configure an isolated app pointing at the isolated DB with all
   external side effects disabled: no outbound email, no Stripe live
   keys, no webhook delivery, no Sentry uploads (unset DSN or use a
   separate test project), no public DNS.
5. Verify in isolation:
   - `npm run db:migrate` is a clean no-op (schema matches journal).
   - Row counts + key integrity: `donation_requests`, `support_offers`,
     `contact_inquiries`, `fulfillment_ledger`, `sponsorship_orders`,
     `request_status_history`, `request_notes` present; public refs
     (`SVS-`, `SUP-`, `CON-`) unique; idempotency keys unique.
   - `/api/health → 200`, `/api/ready → 200` against isolated DB.
   - Admin sign-in with a test allowlist (do not reuse production
     `ADMIN_EMAILS` verbatim in logs).
6. Record: recovery duration, backup timestamp versus restore-completion
   time (data-loss window), and any gaps versus the operator's recovery
   objectives `[OWNER: RPO/RTO]`.
7. Cleanup: delete the isolated database, revoke temporary credentials,
   confirm deletion. Treat dumps/exports as sensitive until deleted.

---

## 5. Incident triage and safe logging

- Triage order: `GET /api/health` (is the web service up?) → `GET
  /api/ready` (is the DB reachable?) → Railway service logs → Sentry
  Issues (if DSN configured) → recent deploy/migration (`git log`,
  Railway deployment history).
- Common signatures:
  - `health 200 + ready 503 database_not_configured` → `DATABASE_URL`
    missing in web service env.
  - `health 200 + ready 503 database_unreachable` → Postgres down,
    networked wrong, or pool exhausted. Check Postgres service status;
    do not restart production blindly during DB maintenance.
  - 503 on public forms → DB unavailable path (generic maintenance
    message by design). Check server logs, not client text.
  - 422 → validation rejection (expected, no Sentry event).
  - 429 → rate limit (`rate_limits` table, 10 req/hr/IP donation
    requests, 20/hr support/contact per README). Check
    `x-forwarded-for` handling: used only for bucketing, never auth.
  - 401 on `/admin` or `/api/admin/*` → fail-closed auth; signed-out or
    non-allowlisted.
- Safe logging rules (enforced in code, follow in ops):
  - Never log `DATABASE_URL`, secrets, request bodies, cookies, headers,
    query strings, emails, or record linkage IDs.
  - Public API errors are generic; detailed DB exceptions go to server
    logs only (`console.error` with message, no payload).
  - CSV exports (`/api/admin/export`) contain PII and are
    `private, no-store`. Download only over admin session, store
    encrypted, delete when done.
  - Security headers are set in `next.config.mjs` (nosniff, DENY
    framing, referrer, Permissions-Policy, CSP). Do not relax CSP to
    debug Sentry; `*.ingest.sentry.io` is already allowed.

---

## 6. Sentry verification and source-map setup

Status: SDK present and sanitized; upload path **disabled by design**;
dashboard settings **UNVERIFIED** (no Sentry access in this audit).

### 6.1 What is implemented (verified in repo)

- Dual init: `instrumentation.ts → sentry.server.config.ts` (Node.js)
  and `instrumentation-client.ts` (browser). Both `enabled` only when
  `NEXT_PUBLIC_SENTRY_DSN` is set **and** `NODE_ENV=production`.
  Local dev and DSN-less builds emit nothing.
- Shared options (`lib/sentry.ts:getSharedSentryOptions`):
  `maxBreadcrumbs: 0`, `dataCollection` with userInfo/cookies/headers/
  bodies/query/GraphQL/genAI/database/stack-vars/context-lines all off.
- Second layer (`lib/sentry-sanitize.ts`, wired via `beforeSend`):
  deletes request bodies/cookies/headers, `user`, `breadcrumbs`,
  `extra`, risky contexts; keeps only method + sanitized URL
  (query/fragment stripped) and allowlist tags `operation`/`route`.
  Long or `@`-containing exception values are replaced with
  `[Redacted]`; frame vars/context lines are redacted.
- Handled-operation events use fixed messages
  (`sentry:<operation>`) with safe tags only; raw DB exceptions are
  never attached. Ten operations allowlisted in `SENTRY_OPERATIONS`.
  Expected failures (validation 422, auth 401, rate-limit 429,
  DB-unavailable 503) create no events. Synthetic event message is
  fixed: `sentry:verification:synthetic-test-event` with tag
  `operation=sentry_verification`.
- Source maps: uploads **disabled**
  (`sourcemaps: { disable: "disable-upload" }`, `widenClientFileUpload:
  false`, no `productionBrowserSourceMaps`). Builds never require
  `SENTRY_AUTH_TOKEN` and never fail when it is absent.

### 6.2 Debugging without source maps (accurate limits)

Traces are not "unreadable": the fixed operation message plus
`operation`/`route` tags, release/environment, timestamp, and
minified stack frames remain observable. What is degraded without
uploaded maps: minified browser frames and server frames cannot be
mapped to original TypeScript lines automatically, so pinpointing the
exact source line requires reproducing against the same built commit
locally. Keep the deployed SHA recorded with every Sentry issue
triage.

### 6.3 Verification procedure — separately approval-gated, DO NOT EXECUTE here

1. Approve: Sentry project, who reviews payloads, and a time-box for
   disabling the test flag.
2. Create a Sentry Next.js project; copy only the DSN (Client Keys).
   Never create or paste `SENTRY_AUTH_TOKEN` for this step.
3. Set `NEXT_PUBLIC_SENTRY_DSN` as a Railway **build-time** variable,
   rebuild/redeploy (inlined into client JS).
4. Set `SENTRY_TEST_ENABLED=true`, redeploy, sign in as allowlisted
   admin, open `/admin`, send the synthetic test event once
   (`sendSentryVerificationEvent`: requires admin session **and** the
   flag; fixed message, no PII).
5. In Sentry → Issues, open the event and confirm: fixed message only,
   tags limited to `operation`/`route`, no names, emails, cookies,
   bodies, query strings, or record IDs. Confirm account-side
   server-side scrubbing, alert routing, access, retention, and data
   region per operator policy.
6. Unset `SENTRY_TEST_ENABLED` and redeploy to remove the test button.
   Record the verification date and reviewer; do not leave the flag on.

### 6.4 Source-map upload setup — separately approval-gated

1. Approve token ownership, storage, and who can upload releases.
2. Provide `SENTRY_ORG` / `SENTRY_PROJECT` (build-time) and inject
   `SENTRY_AUTH_TOKEN` only via Railway secrets (never `NEXT_PUBLIC_`-prefixed,
   never in image, logs, or chat). Current code must be changed to
   re-enable uploads; do not flip flags without a reviewed PR.
3. Verify uploaded maps match the deployed artifacts (release tied to
   deployed SHA) and that browser `.map` files are not publicly served.
   Record the outcome; until then, uploads remain "explicitly deferred".

---

## 7. Stripe sponsorship — disabled mode and activation checklist

Status: code present (Part 3B), **inactive until separately activated**.
No keys are configured by this runbook; nothing here enables charges.

### 7.1 Disabled-mode expectations (verified in repo)

- Gate: `isStripeSponsorshipEnabled()` (`lib/config.ts`) is true only
  when `ENABLE_STRIPE_SPONSORSHIP=true` **and** non-empty
  `STRIPE_SECRET_KEY`. `/api/sponsorship/checkout` additionally requires
  non-empty `STRIPE_WEBHOOK_SECRET`, else `503 { ok: false, message:
  "Online sponsorship is not available yet…" }`.
- `/sponsor` renders cleanly with zero keys: tier table, terms, and the
  public fulfillment ledger (or ledger-unavailable fallback). No Stripe.js
  is loaded and no session is created in disabled mode.
- Webhook (`/api/webhooks/stripe`) is zero-key safe: `503` without
  webhook secret; `400` on missing/invalid signature; `200 { received:
  true }` for verified replays/ignored events; `500 { retryable: true }`
  without persisting the event for unknown orders or processing
  failures so Stripe retries (~3 days) and Dashboard resend stay
  possible. Reconciliation uses Dashboard metadata
  (`publicRef`/`tierCode`/`attemptKey`).
- Safety invariants (tested, `tests/sponsorship*.test*`): server-side
  tier pricing only, attempt-key binding with 409 on tier swap,
  idempotent Stripe `idempotencyKey: sponsorship-checkout-<attemptKey>`,
  `payment_status=paid` required, amount/currency verified, terminal
  states (`refunded`/`partially_refunded`/`expired`) never overwritten,
  partial vs full refunds distinguished via `charge.refunded` +
  `amount_refunded`.
- Launch amounts in `lib/sponsorship.ts` are provisional estimates
  (pound figures approximate, non-tax-deductible, non-refundable except
  billing errors). They remain subject to operator review.

### 7.2 Activation checklist — separate explicit approval required

Do not perform without written operator + finance approval. No test or
live keys are added by this runbook.

1. Approve: live vs test mode, tier amounts, terms version (`v1`),
   refund policy, receipt/tax language, and support contact.
2. Create Stripe account products/prices only if needed (code uses
   inline `price_data`; no price IDs required). Restrict keys by
   environment.
3. Set on Railway (rebuild/restart): `ENABLE_STRIPE_SPONSORSHIP=true`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Never commit keys.
4. Configure webhook endpoint `POST /api/webhooks/stripe` in Stripe
   Dashboard with signing secret matching `STRIPE_WEBHOOK_SECRET`.
5. Test in Stripe test mode end-to-end (checkout → paid webhook →
   ledger entry → refund/partial-refund → expired-session flows),
   then repeat the money-movement test after switching to live only if
   approved.
6. Confirm fulfillment-ledger privacy gating (Section 8) still holds
   with real sponsor data before announcing.

---

## 8. Temple takedown / unpublish and ledger anonymization

Source: `lib/admin-actions.ts:updatePublicListing`,
`lib/public-directory.ts`, `lib/fulfillment-ledger.ts`.

- Directory listing requires a dual gate: `publicListingConsent=true`
  **and** `publicListingStatus="published"`. Only an authenticated admin
  can publish/unpublish. Publishing without opt-in consent is rejected
  server-side. Public reads (`/temples`) select only `publicRef`,
  `templeName`, `city`, `state`, `templeWebsite` (http(s) only),
  `publicListingSummary` (240 chars, sanitized), `publicListingReviewedAt`.
  Contact identity, street address, ZIP, delivery instructions, and notes
  are never selected.
- Takedown (operator or temple request): admin opens the request in
  `/admin`, action `unpublish`, optional summary cleared/shortened.
  Effect is immediate on next revalidation: the temple disappears from
  `/temples` while the original consent record is preserved. An audit
  note (`Public directory: unpublished by <admin email>`) is written to
  `request_notes` (admin-only, never public).
- Ledger anonymization is automatic and read-time: historical
  `fulfillment_ledger` rows linked to the unpublished request render as
  `Participating Temple (ST)` (or `Participating Temple` without state)
  with city omitted. Consent is re-checked on every read, so later
  unpublishing retroactively anonymizes public history without editing
  stored rows. `publicVisible=false` entries never render publicly.
- Do not add a "verified temple" category or certification mark. The
  directory means opt-in + admin-reviewed listing only, not endorsement,
  inspection, or religious ruling.

---

## 9. Production test-data review (exact IDs + approval required)

No delete endpoint exists (verified by search: only test-suite
`DELETE … WHERE … RUN_ID … @example.org` cleanup and FK
`onDelete` clauses). Any production deletion is a manual,
approval-gated database operation. Do not delete without a separate
explicit approval naming each record.

1. List candidates from `/admin` or read-only query: capture exact
   `publicRef` (e.g. `SVS-XXXX-XXXX`) **and** internal `id` (UUID) plus
   `contact_email`, `created_at`, and why each row is test data.
2. Obtain written approval listing every `publicRef`/`id` to delete,
   the executor, and the execution window. Approval for "all test
   records" without IDs is not sufficient.
3. Prefer soft handling first: set request `status` to `withdrawn` via
   `/admin` (writes `request_status_history`) and `unpublish` any
   directory listing, so history is preserved.
4. If hard deletion is approved: back up first (Section 4), delete only
   the approved IDs in a transaction in an isolated session, verify
   child rows (`request_notes`, `request_status_history`) handled per
   FK cascade, re-check `/admin` counts and `/api/ready`, and record
   what was deleted, when, and by whom.
5. Never run test-suite cleanup SQL against production (those `DELETE …
   @example.org` statements are test-scoped and unsafe as a blanket
   filter).

---

## 10. Multilingual sharing (review gate + implementation gap)

Source: `lib/share.ts`, `components/share-section.tsx` (renders English
only), `docs/share-translations-review.md`.

- Published today: English only (`SHARE_LANGUAGES` has `reviewed: true`
  for `en`; `PUBLISHED_SHARE_LANGUAGES` filters on that flag;
  `isPublishedShareLanguage` narrows to `"en"`).
- Drafts for Hindi, Telugu, Tamil, Gujarati exist **only** in
  `docs/share-translations-review.md` as UNREVIEWED candidate wordings.
  Do not copy them into code or public pages.
- Fluent-review bar per language (before any publication): confirms the
  limited claim (some sugar uses animal-derived aids; check the specific
  product), respectful tone, recognizable campaign names, unchanged
  production site URL appended, and no horizontal overflow at 320px in
  the share card.
- Implementation gap: `getShareMessageForLanguage()` currently ignores
  its argument and always returns the English body, and there is no
  per-language message map or dispatch. Flipping `reviewed: true` alone
  does not render the new language. A separate reviewed PR must add a
  reviewed message map + dispatch + behavior tests covering each newly
  published message before any language can genuinely appear.

---

## 11. Documentation-accuracy notes (what this audit corrects)

- Stripe is implemented but inactive. Read `README.md` "not a store"
  together with `.env.example` zero-key safe mode and Section 7 here:
  no checkout, targets, or tax claims are live until the separate
  activation checklist is approved.
- `/poster` already provides the printable temple-kitchen guide
  (`app/poster/page.tsx`, `lib/poster.ts`: 3 steps + caution + QR to
  `/choosing-sugar` + print button). Treat "create a kitchen guide" as
  done; follow-ups are print QA and translations, not a new page.
- Staged migration tests already exist
  (`tests/migration-staged-upgrade.test.ts` + journal-order check).
  Future migration PRs must keep them passing; they do not replace the
  production backup/restore procedure.
- CI (`npm ci`, typecheck, lint, migrate, `vitest run` with real PG,
  production build) is automated. Backup verification, Sentry payload
  review, OAuth allowlist test, takedown handling, and test-data
  deletion are manual and remain Action Needed even when CI is green.

---

## 12. Known limitations and unverified settings

- Backup schedule / retention / last backup / last restore test:
  **UNVERIFIED** — inspect per Section 4.1.
- Sentry alerts / scrubbing rules / access / retention / data region:
  **UNVERIFIED** — account-side, cannot be set from code.
- Source-map uploads: **disabled by design**, never attempted in this
  audit. Enabling requires a code change + secrets (Section 6.4).
- Synthetic Sentry event: **never sent** in this audit
  (`SENTRY_TEST_ENABLED` untouched).
- OAuth redirect URI, custom domain + HTTPS, canonical
  `NEXT_PUBLIC_SITE_URL`: **OWNER-CONFIRM** (code defaults to
  `http://localhost:3000`; production value is build-time).
- `ADMIN_EMAILS` membership, `AUTH_SECRET` rotation, session 8h JWT
  suitability: **OWNER-CONFIRM**.
- CAPTCHA: not implemented (documented tradeoff; add if spam appears).
  File-upload-free + honeypot + rate limits are the current controls.
- No public lookup endpoint by design; audit exports beyond CSV are
  manual.
- Stripe tiers/terms/tax language: provisional, needs operator + finance
  review before activation.

---

## 13. Contacts and placeholders

Replace before launch; do not invent values:

- Production domain / canonical URL: `[OWNER]`
- Railway project + Postgres service IDs: `[OWNER]`
- Database backup owner + RPO/RTO: `[OWNER]`
- Sentry project / DSN owner + alert recipients: `[OWNER]`
- Google OAuth client owner + redirect URI: `[OWNER]`
- Admin allowlist approver: `[OWNER]`
- Temple review / fulfillment owners + SLA: `[OWNER]`
- Privacy/terms legal reviewer: `[OWNER]`
- Stripe finance owner (if ever activated): `[OWNER]`
- Security / abuse contact: `[OWNER]`
