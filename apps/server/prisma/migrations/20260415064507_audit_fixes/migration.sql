-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "weight" DECIMAL(36,0) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RefundProposal" (
    "id" TEXT NOT NULL,
    "onChainId" INTEGER NOT NULL,
    "proposer" TEXT NOT NULL,
    "approver" TEXT,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "campaignId" TEXT NOT NULL,

    CONSTRAINT "RefundProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundProposal_onChainId_key" ON "RefundProposal"("onChainId");

-- AddForeignKey
ALTER TABLE "RefundProposal" ADD CONSTRAINT "RefundProposal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
