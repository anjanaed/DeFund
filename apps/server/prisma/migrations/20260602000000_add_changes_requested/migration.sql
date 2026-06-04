-- AlterEnum: add CHANGES_REQUESTED to CampaignStatus
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';

-- AlterEnum: add CHANGES_REQUESTED to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';

-- AlterTable: add reviewMessage column to Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "reviewMessage" TEXT;
