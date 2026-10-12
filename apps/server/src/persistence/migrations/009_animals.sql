CREATE TABLE world_animals (
  world_id UUID NOT NULL REFERENCES world_sessions (id) ON DELETE CASCADE,
  id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  species TEXT NOT NULL CHECK (species IN ('rabbit')),
  x DOUBLE PRECISION NOT NULL CHECK (x >= 0 AND x <= 500),
  y DOUBLE PRECISION NOT NULL CHECK (y >= 0 AND y <= 500),
  PRIMARY KEY (world_id, id),
  UNIQUE (world_id, ordinal)
);
