-- CreateEnum
CREATE TYPE "PublicReviewStatus" AS ENUM ('NEW', 'REPLY_DRAFTED', 'REPLIED', 'SUSPECTED_FAKE', 'REPORTED', 'REMOVED', 'KEPT');

-- CreateTable
CREATE TABLE "PublicReview" (
    "id" TEXT NOT NULL,
    "reviewerName" TEXT,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "status" "PublicReviewStatus" NOT NULL DEFAULT 'NEW',
    "flagReason" TEXT,
    "replyText" TEXT,
    "assignee" TEXT,
    "internalNotes" TEXT,
    "reportedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicReview_status_postedAt_idx" ON "PublicReview"("status", "postedAt");

-- CreateIndex
CREATE INDEX "PublicReview_rating_idx" ON "PublicReview"("rating");

ALTER TABLE "PublicReview" ADD CONSTRAINT "PublicReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
