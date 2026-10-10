CREATE TABLE world_sessions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK (status IN ('paused', 'running')),
  simulation_tick BIGINT NOT NULL CHECK (simulation_tick >= 0),
  tick_rate INTEGER NOT NULL CHECK (tick_rate > 0),
  seed BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
