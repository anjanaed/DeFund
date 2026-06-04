-- Track how many times a milestone has been submitted for voting (max 2 attempts)
ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "submissionCount" INTEGER NOT NULL DEFAULT 0;
