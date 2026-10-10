ALTER TABLE world_generation
  DROP CONSTRAINT world_generation_width_check,
  ADD CONSTRAINT world_generation_width_check CHECK (width BETWEEN 8 AND 500),
  DROP CONSTRAINT world_generation_height_check,
  ADD CONSTRAINT world_generation_height_check CHECK (height BETWEEN 8 AND 500);

ALTER TABLE world_tiles
  DROP CONSTRAINT world_tiles_x_check,
  ADD CONSTRAINT world_tiles_x_check CHECK (x BETWEEN 0 AND 499),
  DROP CONSTRAINT world_tiles_y_check,
  ADD CONSTRAINT world_tiles_y_check CHECK (y BETWEEN 0 AND 499);
