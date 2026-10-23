# Deployment, backup and recovery

The app is a standard Node.js server (Next.js) plus PostgreSQL. It runs on any host that offers Node 20+ and Postgres
(Hostinger Node.js/VPS hosting, Railway, Render, a VPS, ...). Hostinger *shared* hosting without Node.js support cannot run it;
use a Hostinger VPS or Node.js web-app plan.

## 1. Prerequisites
- Node.js 20 or newer, a PostgreSQL 14+ database (managed, or installed on the VPS).
- A domain with HTTPS. Never run production over plain HTTP: admin cookies are `Secure` in production.
- An API key for the AI provider (Anthropic or an OpenAI-compatible API). Without one the app still works; customers
  simply get their own words back to edit.

## 2. Configure
```bash
cp .env.example .env     # then edit - never commit .env
```
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (dedicated DB user, strong password) |
| `APP_URL` | Public base URL, e.g. `https://reviews.yourdomain.com`. Target of QR codes and CSRF origin check |
| `AUTH_SECRET` | 32+ random chars (`openssl rand -base64 48`). Changing it signs everyone out |
| `GOOGLE_REVIEW_URL` | Seed value only. Real value is edited in Admin > Settings |
| `SALON_NAME` | Seed value only |
| `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, `OPENAI_BASE_URL` | AI configuration (keys are server-only) |
| `AI_DAILY_LIMIT`, `AI_MAX_PER_SESSION`, `AI_TIMEOUT_MS` | Cost controls (defaults 300 / 5 / 15000) |
| `TRUST_PROXY` | `true` behind a reverse proxy that sets `X-Forwarded-For` (Hostinger/nginx/Caddy). Otherwise all visitors share one rate-limit bucket |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Optional: create first admin during seed (password >= 12 chars) |

Find the real Google review link: Google Business Profile > *Get more reviews* (copy the link), or
`https://search.google.com/local/writereview?placeid=<PLACE_ID>` using the Place ID from Google's Place ID Finder.
The app refuses placeholder values and non-Google hosts. **Do not ship before replacing the placeholder.**

## 3. Build and start
```bash
npm ci
npm run build            # generates the Prisma client and builds Next.js
npm run db:migrate       # prisma migrate deploy - applies migrations
npm run db:seed          # creates settings row, example QR locations (reception/checkout/mirror), optional admin
ADMIN_PASSWORD='a-long-unique-password' npm run admin:create -- owner@yourdomain.com   # or ... VIEWER for read-only
npm start                # listens on $PORT (default 3000); run under pm2 / systemd / the host's Node app manager
```
Example pm2: `pm2 start npm --name glamore -- start && pm2 save`.

### HTTPS and domain
1. Point an `A` record (or the host's CNAME) for e.g. `reviews.yourdomain.com` to the server.
2. Terminate TLS at the reverse proxy (Hostinger's SSL, Caddy, or nginx + certbot) and proxy to `localhost:3000`, passing
   `X-Forwarded-For`, `X-Forwarded-Proto` and `Host`.
3. Set `APP_URL` to the final `https://` URL **before** generating QR codes, then rebuild nothing - QR codes are generated on demand.
   If the domain ever changes, regenerate and reprint the cards.

### Scheduled jobs
Run daily (cron): `cd /path/to/app && npm run retention:purge`. It deletes visit statistics older than the configured
retention and *resolved* feedback older than its retention.

## 4. Smoke test after each deploy
1. Open `/review` on a phone, rate, generate a suggestion, copy, tap *Continue to Google Reviews* (check it opens your real listing).
2. Send private feedback; sign in at `/admin/login`; confirm it appears under Feedback.
3. `/admin/qr`: download a QR, scan it with a phone, confirm it opens the live domain.

## 5. Rollback
Application: keep the previous release directory (or git tag). To roll back, check out the previous tag, `npm ci && npm run build`,
restart. Migrations are forward-only; before deploying a release that contains a new migration, take a backup (below). To undo a
bad migration, restore that backup rather than hand-editing the schema.

## 6. Backups and restore
Backup (daily via cron; keep >= 14 days, store off-server, encrypt at rest):
```bash
pg_dump --format=custom --no-owner "$DATABASE_URL_NO_SCHEMA" > backups/glamore-$(date +%F).dump
```
(`DATABASE_URL_NO_SCHEMA` is `DATABASE_URL` without the `?schema=public` suffix, which `pg_dump` does not accept.)
Managed Postgres providers' automated backups/PITR can be used instead; verify retention.

Restore into an empty database:
```bash
createdb glamore_restore
pg_restore --no-owner --dbname glamore_restore backups/glamore-YYYY-MM-DD.dump
# point DATABASE_URL at glamore_restore, restart the app, run the smoke test
```
**Test a restore at least quarterly.** Backups contain customer feedback and must be protected like the live database;
deleted feedback persists in backups until they rotate out - mention this if asked about erasure.

## 7. Security checklist before go-live
- [ ] `AUTH_SECRET` random and unique; `.env` not in git; DB user has least privilege
- [ ] HTTPS enforced; `TRUST_PROXY=true` only behind a trusted proxy
- [ ] Placeholder Google URL replaced; AI key set (or AI disabled)
- [ ] Admin password >= 12 chars, unique; unused example admin removed
- [ ] Privacy notice (`/privacy`) reviewed by the salon and legal advisor; contact email set in Settings
- [ ] Backups scheduled and one restore tested; retention job scheduled
