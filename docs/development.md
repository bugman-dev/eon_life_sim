# Development

Commands below were run from the repository root on Windows with Node.js 24.18.1, npm 11.16.0, and Docker Compose 5.3.0.

## Daily loop

```text
docker compose up db -d
npm run db:migrate
npm run dev:server
npm run dev:web
```

`npm run db:migrate` applies `apps/server/src/persistence/migrations` in filename order. It records applied files in `schema_migrations`. Run it again after adding a migration. Do not edit a migration after it has been applied; add the next numbered file. The server does not migrate itself when started with npm. The Docker server image migrates and then starts.

Current migrations:

- `001_world_sessions.sql` creates the session table.
- `002_world_clock.sql` adds `game_day`, `game_hour`, `game_minute`, and `game_second`, then backfills existing rows as one hour per tick.
- `003_world_map.sql` adds generation metadata, tiles, and static resource deposits.
- `004_world_size_limit.sql` raises the stored map side from 128 to 500.
- `005_flat_terrain.sql` keeps terrain as grass, dirt, sand, and water, and clears elevation, vegetation, and deposits.
- `006_deposit_yield.sql` stores a harvestable amount and a mature growth stage on each deposit, and drops the unused vegetation columns. Existing deposits are backfilled as amount 100 and growth stage 3.
- `007_deposit_amount_config.sql` drops the fixed 100-to-500 amount check. `worldConfig.json` decides the range.
- `008_vegetation.sql` stores one tree, shrub, flower clump, or grass tuft on a tile, with an amount and a growth stage.

The server reads `.env` from the repository root. `DATABASE_URL` must use `localhost` for this workflow. Compose overrides that URL to the `db` hostname inside the server container.

PostgreSQL data is the named volume `life_sim_pg`. A normal `docker compose restart db` keeps it. `docker compose down -v` deletes it.

Integration tests use a separate database, `life_sim_test`, on that same PostgreSQL instance. The test setup creates it when it is missing. Docker needs to be running for those tests.

## Clock configuration

| Variable | Default | Meaning |
|---|---|---|
| `TICK_INTERVAL_MS` | `1000` | Wall-clock delay between ticks while running |
| `TICK_RATE` | `1` | Stored on the session for later speed control |
| `TICK_GAME_SECONDS` | `3600` | In-game seconds added by one tick |
| `PERSIST_EVERY_TICKS` | `5` | How often a running tick is written, besides pause and shutdown |

`3600` is one in-game hour. `60` is one minute. `1` is one second. A day is always 24 hours in the stored clock, so the default day is 24 ticks.

The clock is `tick * TICK_GAME_SECONDS`, converted into day, hour, minute, and second. New worlds start at day 1, 00:00:00, tick 0. With the default, minute and second stay 0. Changing `TICK_GAME_SECONDS` and restarting the server makes the next tick reinterpret the whole tick count. Restart the server after changing `.env`.

The browser adds a display calendar on top of the stored day. A year is 365 days. The header day is the day within that year. Year progress uses the same 365 days plus the fraction of the current day. A month of 30 days is calculated only for the timeline console log. Seasons are not derived.

## World generation

| Variable | Default | Meaning |
|---|---|---|
| `WORLD_WIDTH` | `128` | Tiles across a newly created world |
| `WORLD_HEIGHT` | `128` | Tiles down a newly created world |

Both values must be whole numbers from 8 through 500. The server refuses to start when either one is outside that range. Restart the server after changing them. Worlds already saved keep the size they were generated with. Run `npm run db:migrate` before creating a world larger than 128.

New worlds use generation version `1`. The server derives the map from `world_sessions.seed`. A missing seed is filled in once at creation. The same seed, version, width, and height always produce the same tiles. A saved map is loaded as stored.

A world created before this migration has no map. Opening it shows “This world has no generated map.” Create a new world to generate one. Run `npm run db:migrate` before starting a server that expects the map tables.

## Deposit amounts

`worldConfig.json` in the repository root sets how many deposits a new world gets, and the harvestable amount of each pile. `percent` is a percent of the land tiles, from 0 through 100. Decimals are allowed. Water is not part of the percent, and water tiles stay empty. `minAmount` and `maxAmount` are whole numbers, and the minimum cannot be higher than the maximum. Those two numbers are the only amount range.

```json
{
  "deposits": {
    "stone": { "percent": 0.5, "minAmount": 1000, "maxAmount": 50000 },
    "ore": { "percent": 0.1, "minAmount": 1000, "maxAmount": 50000 },
    "clay": { "percent": 0.2, "minAmount": 1, "maxAmount": 10 }
  }
}
```

`0.5` means about 1 of every 200 land tiles is stone. Each stone pile stores an amount from its minimum through its maximum. Clay is placed only on dirt, so a high clay percent stops when the dirt runs out. Growth stage stays 3. The same seed and the same file give the same piles and amounts. Restart the server after editing the file. Worlds already saved keep the deposits they were created with. Run `npm run db:migrate` so stored amounts are no longer limited to 100 through 500.

`vegitation` in the same file sets trees, shrubs, flowers, and grass tufts. `percent` is again a percent of the land tiles. Only `tree` has `minAmount` and `maxAmount`. Shrubs, flowers, and grass tufts store amount 0. A tile holds one plant. Trees prefer grass, appear rarely on sand, and least often on dirt. Most trees are growth stage 3. The other plants grow only on grass and stay at stage 3. Run `npm run db:migrate` before creating a world that stores plants.

## UI live reload

`docker compose up` serves a built copy of the site. A UI edit appears only after `docker compose up --build`. For live reload, keep the database and the server in Docker and run the site with Vite:

```text
docker compose stop web
npm run dev:web
```

Open http://localhost:5173/. Saving a file in `apps/web` updates the browser. The Docker server on port 3000 stays up, so the clock and play/pause commands keep working.

Stop the `web` container first. It already uses port 5173. When the container site is needed again, stop Vite with Ctrl+C, then:

```text
docker compose up --build -d web
```

## Reference layout

These files are intentionally static. Later phases should replace the hardcoded values. They are not wired to the session or the clock.

- `apps/web/src/components/floatingStats.tsx`
- `apps/web/src/components/activeTasks.tsx`
- `apps/web/src/components/worldStatus.tsx`
- `apps/web/src/components/selectedItemData.tsx`
- `apps/web/src/components/recentEvents.tsx`
- `apps/web/src/components/navigationSide.tsx`
- The Step, notifications, and settings buttons in `navigationTop.tsx`

`apps/web/src/features/` still holds the first connection, session, and clock panels. The dashboard replaced them. They remain as the earlier control layout.

Live UI:

- Connection, protocol, and phase in the top bar
- Create, load, and delete in the world menu
- Play and pause in the top bar and in `eonTimeline.tsx`
- Errors in `apps/web/src/modals/errorModal.tsx`
- The generated map in `apps/web/src/rendering/PixiViewport.tsx`

The last world id is stored in the browser under `life-simulator:last-world-id`.

## What was verified

- `npm test` on 10 October 2026 — 10 files, 28 tests passed. Coverage includes clock rules, the hour mapping, protocol validation, deterministic world generation, map persistence and rollback, configured map size, world deletion, configuration, health and readiness, database restart behavior, and two WebSocket clients sharing one clock without receiving the map on a tick.
- `npm run typecheck`
- `npm run db:migrate` applies `001_world_sessions.sql`, `002_world_clock.sql`, and `003_world_map.sql` on a database that does not already have them.
- A live server at `http://127.0.0.1:3000` created a world, advanced the tick for two clients, paused, and returned that same paused tick after a new connection.
- `GET /health` and `GET /ready` returned ok while PostgreSQL was up.
- `docker compose up --build` served the site and the server. Health, readiness, and creating a world through the container succeeded. The container image needs a rebuild before it includes map generation.

## Deploying later

Compose binds the web app, the server, and PostgreSQL to `127.0.0.1`. That is correct while everything runs on one computer.

On the headless server, browsers on other machines cannot reach `127.0.0.1`. Change only the web and server port bindings if those machines are on the trusted LAN, and rebuild the web image with `VITE_WS_URL` set to the address the browser will use. Leave PostgreSQL on `127.0.0.1`. Do not add router port forwarding or a public DNS name in this phase.

There is no authentication. Keep the service on a trusted network.

## Known issues

- The dev database password in `.env.example` is the placeholder `replace_me`.
- Docker must be running before `npm run dev:server`. Without it, startup retries and then exits.
- The header season and time, and the World Status card, stay on Spring. Seasons are a later step.
- A 30-day month and a 365-day year are both derived from the same day count, so they do not land on the same boundaries.
- There is no lint or format script. `npm test` and `npm run typecheck` are the checks.
