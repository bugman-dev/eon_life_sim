# Life Simulator

Phase 1 is a server-authoritative world. A browser can connect, create or load a world session, and start, pause, or resume a clock that PostgreSQL remembers. Creating a world also generates a map from its seed. The default grid is 128×128. `WORLD_WIDTH` and `WORLD_HEIGHT` choose another size from 8 to 500 for worlds created after a restart. The browser draws that map and does not own simulation time. No creatures or AI are included.

The dashboard around the map is a reference layout for later phases. Population, tasks, events, and the other cards are hardcoded. The live data is the connection, the world session, the generated map, and the clock.

A tick is the simulation counter. By default one tick is one in-game hour. The server derives the day, hour, minute, and second from that counter and stores them with the session. The browser turns those fields into a year and a day-of-year. Seasons are not simulated yet.

## Requirements

Verified on this machine:

- Node.js 24.18.1
- npm 11.16.0
- Docker Compose 5.3.0

## Run locally

Copy `.env.example` to `.env` before the first run. The sample database password is `replace_me` and is only for this local database.

Start PostgreSQL, apply migrations, then start the two apps from the repository root:

```text
docker compose up db -d
npm run db:migrate
npm run dev:server
npm run dev:web
```

Open http://localhost:5173/. The server health check is http://localhost:3000/health and readiness is http://localhost:3000/ready.

Playing the clock is described in [docs/how-to-play.md](docs/how-to-play.md). Setup, the clock configuration, and UI live reload are in [docs/development.md](docs/development.md). The phase outcome is in [docs/phase-0-report.md](docs/phase-0-report.md).

## Run the full stack in Docker

```text
docker compose up --build
```

The web image is a static build. `VITE_WS_URL` is taken from `.env` at build time, so a UI edit needs a rebuild or the Vite workflow in the development guide. Compose publishes the site and the server on `127.0.0.1` only. PostgreSQL is also limited to `127.0.0.1:5432`.

`docker compose down -v` deletes the database volume.

## Checks

```text
npm test
npm run typecheck
```

`npm test` currently runs 28 tests across 10 files.

## Limits

- The service assumes a trusted machine. There is no authentication.
- The clock fires once per `TICK_INTERVAL_MS` while running. `TICK_GAME_SECONDS` says how much in-game time that tick represents. The default is 3600, one hour.
- Changing `TICK_GAME_SECONDS` reinterprets every existing tick. The calendar is calculated from the tick, not stored as its own timeline.
- Tick progress is stored every `PERSIST_EVERY_TICKS` ticks, and again on pause or shutdown. A crash can drop the unsaved ticks since the last write.
- Creating a world always creates a new session. Refreshing the browser reloads the last session id saved in the browser.
- Restarting the server returns every session paused at its last saved tick.
- Delete Current World removes that world's session, map, tiles, and deposits. Step, the side navigation, and the stat cards are present for later work. They do not change the simulation.
- AI and living entities are later phases. Vegetation and deposits on the map are static features of the generated world.
