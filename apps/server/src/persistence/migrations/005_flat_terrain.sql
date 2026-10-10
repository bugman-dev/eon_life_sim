ALTER TABLE world_tiles DROP CONSTRAINT world_tiles_terrain_type_check;

UPDATE world_tiles
SET
  terrain_type = CASE terrain_type
    WHEN 'deep_water' THEN 'water'
    WHEN 'shallow_water' THEN 'water'
    WHEN 'grassland' THEN 'grass'
    WHEN 'rocky' THEN 'dirt'
    WHEN 'mountain' THEN 'dirt'
    ELSE terrain_type
  END,
  elevation = 0,
  vegetation_type = 'none',
  vegetation_density = 0;

DELETE FROM world_resource_deposits;

ALTER TABLE world_tiles
  ADD CONSTRAINT world_tiles_terrain_type_check
  CHECK (terrain_type IN ('grass', 'dirt', 'sand', 'water'));
