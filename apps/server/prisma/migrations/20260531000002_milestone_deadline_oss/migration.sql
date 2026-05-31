-- Add per-milestone deadline
ALTER TABLE "Milestone" ADD COLUMN "deadline" TIMESTAMP(3);

-- Rename githubUrl → repositoryUrl on Campaign
ALTER TABLE "Campaign" RENAME COLUMN "githubUrl" TO "repositoryUrl";

-- Add OSS license field to Campaign
ALTER TABLE "Campaign" ADD COLUMN "license" TEXT;
