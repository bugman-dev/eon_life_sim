ALTER TABLE world_sessions
  ADD COLUMN game_day INTEGER,
  ADD COLUMN game_hour INTEGER,
  ADD COLUMN game_minute INTEGER,
  ADD COLUMN game_second INTEGER;

UPDATE world_sessions
SET
  game_day = (1 + simulation_tick / 24::bigint)::integer,
  game_hour = (simulation_tick % 24::bigint)::integer,
  game_minute = 0,
  game_second = 0;

ALTER TABLE world_sessions
  ALTER COLUMN game_day SET NOT NULL,
  ALTER COLUMN game_hour SET NOT NULL,
  ALTER COLUMN game_minute SET NOT NULL,
  ALTER COLUMN game_second SET NOT NULL,
  ADD CONSTRAINT world_sessions_game_day_check CHECK (game_day >= 1),
  ADD CONSTRAINT world_sessions_game_hour_check CHECK (game_hour BETWEEN 0 AND 23),
  ADD CONSTRAINT world_sessions_game_minute_check CHECK (game_minute BETWEEN 0 AND 59),
  ADD CONSTRAINT world_sessions_game_second_check CHECK (game_second BETWEEN 0 AND 59);
