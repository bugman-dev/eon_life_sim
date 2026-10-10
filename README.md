# Life Simulator

Phase 0 is a server-authoritative simulation shell. A browser can connect, create or load a world session, and start, pause, or resume a clock that PostgreSQL remembers. The browser does not own simulation time. No terrain, creatures, or AI are included.

## Requirements

Verified on this machine:

- Node.js 24.18.1
- npm 11.16.0
- Docker Compose 5.3.0

## Run locally

Start PostgreSQL, apply migrations, then start the two apps from the repository root:

```text
docker compose up db -d
npm run db:migrate
npm run dev:server
npm run dev:web
```

Open http://localhost:5173/. The server health check is http://localhost:3000/health and readiness is http://localhost:3000/ready.

Playing the clock, including start and stop, is described in [docs/how-to-play.md](docs/how-to-play.md).

Copy `.env.example` to `.env` before the first run. The sample database password is `replace_me` and is only for this local database.

## Run the full stack in Docker

```text
docker compose up --build
```

The web image is a static build. `VITE_WS_URL` is taken from `.env` at build time. Compose publishes the site and the server on `127.0.0.1` only. PostgreSQL is also limited to `127.0.0.1:5432`.

`docker compose down -v` deletes the database volume.

## Checks

```text
npm test
npm run typecheck
```

## Limits

- The service assumes a trusted machine. There is no authentication.
- A tick is a simulation counter, not a day or a real second. The clock fires once per `TICK_INTERVAL_MS` while running.
- Tick progress is stored every `PERSIST_EVERY_TICKS` ticks, and again on pause or shutdown. A crash can drop the unsaved ticks since the last write.
- Creating a world always creates a new session. Refreshing the browser reloads the last session id saved in the browser.
- Restarting the server returns every session paused at its last saved tick.
- AI, maps, and living entities are later phases.
