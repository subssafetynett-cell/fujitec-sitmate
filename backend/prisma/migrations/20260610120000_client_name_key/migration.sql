-- Case-insensitive client name uniqueness via normalized nameKey.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "nameKey" TEXT;

UPDATE "Client"
SET "nameKey" = lower(regexp_replace(trim("name"), '\s+', '', 'g'))
WHERE "nameKey" IS NULL OR trim("nameKey") = '';

-- Merge duplicate nameKey rows before adding the unique constraint.
WITH ranked AS (
  SELECT
    id,
    "nameKey",
    ROW_NUMBER() OVER (
      PARTITION BY "nameKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Client"
),
losers AS (
  SELECT r.id AS loser_id, k.id AS keeper_id
  FROM ranked r
  INNER JOIN ranked k ON r."nameKey" = k."nameKey" AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE "User" u
SET "clientId" = l.keeper_id
FROM losers l
WHERE u."clientId" = l.loser_id;

WITH ranked AS (
  SELECT
    id,
    "nameKey",
    ROW_NUMBER() OVER (
      PARTITION BY "nameKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Client"
),
losers AS (
  SELECT r.id AS loser_id, k.id AS keeper_id
  FROM ranked r
  INNER JOIN ranked k ON r."nameKey" = k."nameKey" AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE "Site" s
SET "clientId" = l.keeper_id
FROM losers l
WHERE s."clientId" = l.loser_id;

WITH ranked AS (
  SELECT
    id,
    "nameKey",
    ROW_NUMBER() OVER (
      PARTITION BY "nameKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Client"
)
DELETE FROM "Client" c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

ALTER TABLE "Client" ALTER COLUMN "nameKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_nameKey_key" ON "Client"("nameKey");
