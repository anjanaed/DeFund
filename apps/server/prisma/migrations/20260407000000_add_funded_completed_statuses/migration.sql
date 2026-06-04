-- Add FUNDED value to CampaignStatus enum
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'FUNDED';

-- Add COMPLETED value to MilestoneStatus enum
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- Add releasedAmount and paymentToken columns to Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "releasedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "paymentToken" TEXT NOT NULL DEFAULT 'ETH';
