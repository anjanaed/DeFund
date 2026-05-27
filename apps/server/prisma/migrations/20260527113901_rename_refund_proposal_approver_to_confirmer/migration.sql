/*
  Warnings:

  - You are about to drop the column `approver` on the `RefundProposal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RefundProposal" DROP COLUMN "approver",
ADD COLUMN     "confirmer" TEXT;
