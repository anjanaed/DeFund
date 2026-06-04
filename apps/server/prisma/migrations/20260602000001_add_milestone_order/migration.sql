-- Add explicit ordering column to milestones.
-- All milestones in a single campaign share the same createdAt (same transaction),
-- making orderBy createdAt non-deterministic. This column stores the creator-intended order.
ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows: assign 0-based index within each campaign using the
-- physical heap order (ctid), which reflects actual insertion sequence.
WITH ranked AS (
  SELECT id,
    (ROW_NUMBER() OVER (PARTITION BY "campaignId" ORDER BY ctid) - 1)::int AS rn
  FROM "Milestone"
)
UPDATE "Milestone" m
SET "order" = ranked.rn
FROM ranked
WHERE m.id = ranked.id;
