-- AlterTable Campaign: add IPFS-backed media fields
-- images stores IPFS CIDs; documents stores [{ name, cid, mimetype }]
ALTER TABLE "Campaign" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
                       ADD COLUMN     "documents" JSONB;
