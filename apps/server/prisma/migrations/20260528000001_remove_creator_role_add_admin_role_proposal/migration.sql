-- Step 1: migrate any CREATOR users to USER before removing the enum value
UPDATE "User" SET "role" = 'USER' WHERE "role" = 'CREATOR';

-- Step 2: remove CREATOR from UserRole enum
-- PostgreSQL requires recreating the type to remove a value.
-- Must drop the column default first because it references the old enum type.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING "role"::text::"UserRole_new";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole_new";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 3: add ADMIN_ROLE_PROPOSED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_ROLE_PROPOSED';

-- Step 4: create AdminRoleProposal table
CREATE TABLE "AdminRoleProposal" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetRole" "UserRole" NOT NULL,
    "proposer" TEXT NOT NULL,
    "confirmer" TEXT,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRoleProposal_pkey" PRIMARY KEY ("id")
);

-- Step 5: foreign key
ALTER TABLE "AdminRoleProposal" ADD CONSTRAINT "AdminRoleProposal_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
