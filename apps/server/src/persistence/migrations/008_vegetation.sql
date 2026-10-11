CREATE TABLE world_vegetation (
  world_id UUID NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  vegetation_type TEXT NOT NULL CHECK (vegetation_type IN ('tree', 'shrubs', 'flowers', 'grass')),
  amount INTEGER NOT NULL,
  growth_stage INTEGER NOT NULL CHECK (growth_stage IN (1, 2, 3)),
  PRIMARY KEY (world_id, x, y),
  FOREIGN KEY (world_id, x, y) REFERENCES world_tiles (world_id, x, y) ON DELETE CASCADE
);
