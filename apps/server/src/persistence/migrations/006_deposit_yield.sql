ALTER TABLE world_resource_deposits
  ADD COLUMN amount INTEGER NOT NULL DEFAULT 100 CHECK (amount BETWEEN 100 AND 500),
  ADD COLUMN growth_stage INTEGER NOT NULL DEFAULT 3 CHECK (growth_stage = 3);

ALTER TABLE world_resource_deposits
  ALTER COLUMN amount DROP DEFAULT,
  ALTER COLUMN growth_stage DROP DEFAULT;

ALTER TABLE world_tiles
  DROP COLUMN vegetation_type,
  DROP COLUMN vegetation_density;
