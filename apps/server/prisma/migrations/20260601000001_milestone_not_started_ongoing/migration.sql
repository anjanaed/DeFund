-- Rename PENDING → ONGOING in the MilestoneStatus enum
ALTER TYPE "MilestoneStatus" RENAME VALUE 'PENDING' TO 'ONGOING';

-- Add the new NOT_STARTED value
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'NOT_STARTED';
