# Trying it on Vercel

## 1. Instant demo (no database)
`/demo` is a self-contained walkthrough with sample data: the customer QR flow (try 1-5 stars) and the team's Google-review
workflow (templates, flag/report with required reason). It needs **no environment variables and no database**.

1. Push this branch to GitHub. In Vercel: **Add New > Project**, import the repo, choose this branch.
2. Framework: Next.js (auto-detected). Add only `AUTH_SECRET` (any long random string) and `APP_URL` (your Vercel URL) if the build asks.
3. Deploy, then open `https://<your-project>.vercel.app/demo`.

## 2. The real app on Vercel
Needs a hosted Postgres (Vercel Postgres/Neon/Supabase). Set `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `GOOGLE_REVIEW_URL`,
`AI_PROVIDER` + key, then run once from your machine: `npm run db:migrate && npm run db:seed` and
`ADMIN_PASSWORD='...' npm run admin:create -- you@example.com`. Note: the in-memory rate limiter is per serverless instance;
see `docs/DEPLOYMENT.md`.
