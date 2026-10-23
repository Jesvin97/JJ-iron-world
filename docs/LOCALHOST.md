# Run on your computer (localhost)

Needs: Node 20+, PostgreSQL 14+ (or Docker).

```bash
git clone https://github.com/Jesvin97/JJ-iron-world.git && cd JJ-iron-world
git checkout ccr-c6cae07f-9hwd6t

# 1. Database (Docker option; or use any local Postgres)
docker run -d --name glamore-db -e POSTGRES_USER=glamore -e POSTGRES_PASSWORD=glamore -e POSTGRES_DB=glamore -p 5432:5432 postgres:16

# 2. Config
cp .env.example .env
#   set: DATABASE_URL="postgresql://glamore:glamore@localhost:5432/glamore?schema=public"
#        APP_URL="http://localhost:3000"
#        AUTH_SECRET="<any 32+ random characters>"
#   no AI key yet? also set: AI_PROVIDER="mock" and ALLOW_MOCK_AI="true"  (mock just echoes the customer's text)

# 3. Install, migrate, seed, create admin, run
npm install
npm run db:migrate && npm run db:seed
ADMIN_PASSWORD='choose-a-long-password' npm run admin:create -- you@example.com
npm run dev
```
- Customer page: http://localhost:3000/review (QR location example: `/review?c=reception`)
- Admin: http://localhost:3000/admin  (sign in with the email/password above)
- Test on your phone: use `http://<your-computer-LAN-IP>:3000/review` on the same Wi-Fi.
- First set the real Google review URL in Admin > Settings; until then the Google button shows "not available yet".
