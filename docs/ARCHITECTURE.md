# Architecture

## Stack
Next.js 15 (App Router) + TypeScript, Tailwind CSS 3, PostgreSQL + Prisma 6, Zod validation, `jose` (signed session JWT) +
`bcryptjs` (password hashing) for admin auth, `qrcode` for QR generation. UI components are small hand-written accessible
components (no shadcn CLI dependency). Tests: Vitest (unit + DB-backed API tests) and Playwright (mobile journey).

## Routes
| Route | Purpose |
|---|---|
| `/review[?c=slug]` | Customer flow: rate > describe > AI suggestion > copy / Google link; optional private feedback |
| `/privacy` | Privacy notice (uses settings) |
| `/admin/login`, `/admin`, `/admin/feedback[/id]`, `/admin/qr[/print]`, `/admin/settings` | Admin area (server-side guarded on every page) |
| `POST /api/sessions`, `POST /api/sessions/:id/events` | Anonymous visit + funnel events (rating, copy, google_click) |
| `POST /api/ai/suggest` | AI suggestion (server-side provider call) |
| `POST /api/feedback` | Private feedback |
| `GET /api/public/settings` | Customer-safe settings only |
| `/api/admin/*` | login, logout, feedback (list/get/patch/delete/export), settings, campaigns, stats, qr |

## Key decisions
- **No review gating.** The Google link is returned by the same settings call for every visitor and rendered for every rating;
  rating never changes which actions are shown. Tests assert this.
- **Clicks are clicks.** The admin UI labels "Google link clicks"; no claim is made about published reviews.
- **AI safety.** Server-only prompt (see `src/lib/ai.ts`); contact details/links stripped before sending; output validated
  (JSON schema, length limits, no links/markup/contact details, no numbers absent from the customer's text); too-short input
  gets "tell us more" without a provider call; 15s timeout; per-session (5) and daily (300) caps; failure falls back to the
  customer's own text. Nothing is ever auto-published.
- **Analytics privacy.** A session row holds a random per-tab id, optional campaign, rating and three flags. No IP, user-agent or
  fingerprint is stored. Reloads of the same tab within 30 min reuse the session, so "scans" = distinct visits, "unique sessions"
  = distinct tab ids.
- **Contact data minimisation.** Email/phone are discarded server-side unless the customer ticks consent; CSV export includes
  contact details only for consenting customers.
- **Auth.** bcrypt (cost 12), 8h HS256 JWT in an `HttpOnly; SameSite=Strict; Secure` cookie, user re-read from the DB on every
  request (revocation is immediate), roles `ADMIN` (write) / `VIEWER` (read-only), login rate limits (per IP and per account),
  Origin check on all cookie-authenticated mutations, `Cache-Control: no-store` on admin and API.
- **Rate limiting** is in-memory per process (fine for a single Node process; use Redis for multi-instance).
- **Security headers/CSP** in `next.config.mjs`.

## Data model
See `prisma/schema.prisma`. Additions to the brief: `Campaign.slug` (URL-safe id), settings fields for AI/webhook/retention,
and DB CHECK constraints (rating 1-5, singleton settings, slug format, retention minimums) in migration `*_constraints`.
`FeedbackSubmission.generatedText/editedText` are reserved and not collected in the MVP.

## Known limitations / not built
- Email notifications (a webhook is provided instead).
- Google Business Profile API integration (reading/replying to reviews) - future, requires Google API access approval.
- Multi-instance rate limiting; per-admin audit log; password reset UI (use `npm run admin:create` to reset).
- The `/privacy` text is a sensible starting point, not legal advice.
