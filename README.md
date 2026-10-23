# Glam’more AI Review Assistant

Mobile-first QR review app for Glam’more Premium Unisex Salon & Spa: customers rate their visit, get optional AI help wording
their *own* experience, copy it and post it themselves on Google; optional private feedback goes to an admin dashboard.
Every rating gets the same access to the Google review link (no review gating).

## Local development
```bash
cp .env.example .env            # set DATABASE_URL, APP_URL, AUTH_SECRET; AI_PROVIDER=mock + ALLOW_MOCK_AI=true for offline dev
npm install
npm run db:migrate && npm run db:seed
ADMIN_PASSWORD='a-long-unique-password' npm run admin:create -- you@example.com
npm run dev                     # http://localhost:3000/review  and  /admin
```

## Quality checks
```bash
npm run typecheck && npm run lint
npm test                        # needs Postgres: TEST_DATABASE_URL (default postgresql://glamore:glamore@localhost:5432/glamore_test)
npm run build
npm run test:e2e                # Playwright mobile journey; needs E2E_DATABASE_URL DB and a Chromium (E2E_CHROMIUM_PATH)
```
Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (deploy, rollback, backup/restore).
