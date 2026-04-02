-- AlterTable User: add nonce field for wallet authentication
ALTER TABLE "User" ADD COLUMN "nonce" TEXT;

-- AlterTable Campaign: add blockchain tracking fields
ALTER TABLE "Campaign" ADD COLUMN "onChainId" INTEGER,
                       ADD COLUMN "isAdminApproved" BOOLEAN NOT NULL DEFAULT false,
                       ADD COLUMN "ipfsHash" TEXT;

CREATE UNIQUE INDEX "Campaign_onChainId_key" ON "Campaign"("onChainId");

-- AlterTable Milestone: add blockchain tracking fields
ALTER TABLE "Milestone" ADD COLUMN "onChainId" INTEGER,
                        ADD COLUMN "votingEndTime" TIMESTAMP(3);

CREATE UNIQUE INDEX "Milestone_onChainId_key" ON "Milestone"("onChainId");

-- AlterTable Contribution: add refunded flag
ALTER TABLE "Contribution" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable IndexerState: tracks the last indexed block number
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastBlock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);
