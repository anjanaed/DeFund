/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `RefundProposal` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FLAG_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE 'RELEASE_FUNDS_PROPOSED';

-- AlterTable
ALTER TABLE "RefundProposal" DROP COLUMN "expiresAt";

-- CreateTable
CREATE TABLE "FlagProposal" (
    "id" TEXT NOT NULL,
    "onChainId" INTEGER NOT NULL,
    "proposer" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confirmer" TEXT,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,

    CONSTRAINT "FlagProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseFundsProposal" (
    "id" TEXT NOT NULL,
    "onChainId" INTEGER NOT NULL,
    "proposer" TEXT NOT NULL,
    "confirmer" TEXT,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "milestoneId" TEXT NOT NULL,

    CONSTRAINT "ReleaseFundsProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlagProposal_onChainId_key" ON "FlagProposal"("onChainId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseFundsProposal_onChainId_key" ON "ReleaseFundsProposal"("onChainId");

-- AddForeignKey
ALTER TABLE "FlagProposal" ADD CONSTRAINT "FlagProposal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseFundsProposal" ADD CONSTRAINT "ReleaseFundsProposal_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
