-- AlterTable: add nullable eventKey column to Notification
ALTER TABLE "Notification" ADD COLUMN "eventKey" TEXT;

-- CreateIndex: unique constraint for deduplication
CREATE UNIQUE INDEX "Notification_userId_eventKey_key" ON "Notification"("userId", "eventKey");
