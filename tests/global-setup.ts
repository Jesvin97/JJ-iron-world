import { execSync } from "node:child_process";

export const TEST_DB = process.env.TEST_DATABASE_URL || "postgresql://glamore:glamore@localhost:5432/glamore_test?schema=public";

export default function setup() {
  // Applies all migrations to the dedicated test database (never the dev/production one).
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB },
  });
}
