-- Database-level constraints (not expressible in the Prisma schema)
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_aiGenerationCount_check" CHECK ("aiGenerationCount" >= 0);
ALTER TABLE "SalonSettings" ADD CONSTRAINT "SalonSettings_singleton_check" CHECK ("id" = 'singleton');
ALTER TABLE "SalonSettings" ADD CONSTRAINT "SalonSettings_retention_check" CHECK ("feedbackRetentionDays" >= 30 AND "analyticsRetentionDays" >= 7);
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_slug_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{0,39}$');
