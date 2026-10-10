CREATE TABLE world_generation (
  world_id UUID PRIMARY KEY REFERENCES world_sessions (id) ON DELETE CASCADE,
  generation_version INTEGER NOT NULL CHECK (generation_version = 1),
  width INTEGER NOT NULL CHECK (width BETWEEN 8 AND 128),
  height INTEGER NOT NULL CHECK (height BETWEEN 8 AND 128),
  tile_size INTEGER NOT NULL CHECK (tile_size = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE world_tiles (
  world_id UUID NOT NULL REFERENCES world_sessions (id) ON DELETE CASCADE,
  x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 127),
  y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 127),
  terrain_type TEXT NOT NULL CHECK (
    terrain_type IN ('deep_water', 'shallow_water', 'sand', 'grassland', 'rocky', 'mountain')
  ),
  elevation DOUBLE PRECISION NOT NULL CHECK (elevation >= 0 AND elevation <= 1),
  water_type TEXT NOT NULL CHECK (water_type IN ('none', 'lake', 'river', 'coast')),
  soil_type TEXT NOT NULL CHECK (soil_type IN ('poor', 'normal', 'fertile')),
  fertility INTEGER NOT NULL CHECK (fertility BETWEEN 0 AND 100),
  vegetation_type TEXT NOT NULL CHECK (vegetation_type IN ('none', 'grass', 'forest')),
  vegetation_density DOUBLE PRECISION NOT NULL CHECK (vegetation_density >= 0 AND vegetation_density <= 1),
  PRIMARY KEY (world_id, x, y)
);

CREATE TABLE world_resource_deposits (
  world_id UUID NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  deposit_type TEXT NOT NULL CHECK (deposit_type IN ('stone', 'ore', 'clay')),
  PRIMARY KEY (world_id, x, y, deposit_type),
  FOREIGN KEY (world_id, x, y) REFERENCES world_tiles (world_id, x, y) ON DELETE CASCADE
);
