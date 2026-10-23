/** Run daily from cron: `npm run retention:purge`. */
import { purgeExpiredData } from "../src/lib/retention";
import { db } from "../src/lib/db";

purgeExpiredData()
  .then((r) => console.log(`Retention purge: ${r.sessionsDeleted} sessions, ${r.feedbackDeleted} resolved feedback deleted`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
