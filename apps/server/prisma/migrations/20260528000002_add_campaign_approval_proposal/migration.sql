-- Add CAMPAIGN_APPROVAL_PROPOSED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_APPROVAL_PROPOSED';

-- Create CampaignApprovalProposal table
CREATE TABLE "CampaignApprovalProposal" (
    "id" TEXT NOT NULL,
    "proposer" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,

    CONSTRAINT "CampaignApprovalProposal_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one active proposal per campaign
ALTER TABLE "CampaignApprovalProposal"
    ADD CONSTRAINT "CampaignApprovalProposal_campaignId_key" UNIQUE ("campaignId");

-- Foreign key
ALTER TABLE "CampaignApprovalProposal"
    ADD CONSTRAINT "CampaignApprovalProposal_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
