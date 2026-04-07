-- Add fundsReclaimed flag to Campaign
-- Set to true by indexer when RefundApproved event fires on-chain
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "fundsReclaimed" BOOLEAN NOT NULL DEFAULT false;
