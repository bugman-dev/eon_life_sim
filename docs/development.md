# Development

Commands below were run from the repository root on Windows with Node.js 24.18.1, npm 11.16.0, and Docker Compose 5.3.0.

## Daily loop

```text
docker compose up db -d
npm run db:migrate
npm run dev:server
npm run dev:web
```

`npm run db:migrate` applies `apps/server/src/persistence/migrations`. It records applied files in `schema_migrations`. Run it again after adding a migration. The server does not migrate itself when started with npm.

The server reads `.env` from the repository root. `DATABASE_URL` must use `localhost` for this workflow. Compose overrides that URL to the `db` hostname inside the server container.

PostgreSQL data is the named volume `life_sim_pg`. A normal `docker compose restart db` keeps it. `docker compose down -v` deletes it.

## What was verified

- `npm test` — 15 tests passed, including clock rules, protocol validation, database restart behavior, and two WebSocket clients sharing one clock.
- `npm run typecheck`
- `npm run db:migrate` on a fresh database applied `001_world_sessions.sql`.
- A live server at `http://127.0.0.1:3000` created a world, advanced the tick for two clients, paused, and returned that same paused tick after a new connection.
- `GET /health` and `GET /ready` returned ok while PostgreSQL was up.
- The Vite app at `http://localhost:5173/` compiled the session and clock panels.
- `docker compose up --build` served the site and the server. Health, readiness, and creating a world through the container succeeded.

## Deploying later

Compose binds the web app, the server, and PostgreSQL to `127.0.0.1`. That is correct while everything runs on one computer.

On the headless server, browsers on other machines cannot reach `127.0.0.1`. Change only the web and server port bindings if those machines are on the trusted LAN, and rebuild the web image with `VITE_WS_URL` set to the address the browser will use. Leave PostgreSQL on `127.0.0.1`. Do not add router port forwarding or a public DNS name in this phase.

## Known issues

- The dev database password in `.env.example` is the placeholder `replace_me`.
- Docker must be running before `npm run dev:server`. Without it, startup retries and then exits.
- The PixiJS panel is an empty viewport. It is not a world renderer.
