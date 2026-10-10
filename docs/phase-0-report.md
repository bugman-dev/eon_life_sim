# Phase 0 report

**Date:** 10 October 2026
**Status:** Complete
**Scope:** Foundation only. The server owns a world session and its clock. The browser watches and sends start, pause, and resume.

This report records what was built and how it differs from the original Phase 0 plan. The plan stays in `life_simulator_phase_0_implementation_plan.md`. Day-to-day use is in [how-to-play.md](how-to-play.md), [development.md](development.md), and [architecture.md](architecture.md).

## Outcome

A local stack can do the Phase 0 loop:

1. Start PostgreSQL, the server, and the site with Docker Compose, or run the apps with npm against the database container.
2. Open the browser and connect over WebSocket.
3. Create a world, or load one by id.
4. See connection status, protocol version, the world name and seed, the world id inside the Create World dialog, and the running or paused clock.
5. Start, pause, and resume. Two tabs follow the same server clock.
6. Refresh and return to the same persisted world.
7. Restart the server and find the world paused at its last saved tick.

The browser does not advance the tick. PostgreSQL is the only store. No terrain, entities, needs, or AI are implemented.

## What was delivered

| Area | Result |
|---|---|
| Repository | npm workspaces for `apps/web`, `apps/server`, and `packages/shared`. TypeScript, Vitest, `.env.example`, and `.gitignore`. Node.js 24.18.1, npm 11.16.0, and Docker Compose 5.3.0 were verified on the development machine. |
| Client | React 19 and Vite. Networking lives under `apps/web/src/networking`. PixiJS is isolated in an empty viewport. |
| Server | Fastify, validated environment, `/health`, `/ready`, structured logs, and SIGTERM/SIGINT shutdown that pauses the clock and closes the database. |
| Database | PostgreSQL 16 in Compose, named volume `life_sim_pg`, port bound to `127.0.0.1`. Migrations `001_world_sessions.sql` and `002_world_clock.sql`. |
| Protocol | Version 1 in `packages/shared`. Create, get, start, pause, and resume. Request ids, Zod validation, 16KB client limit, and structured errors. |
| Clock | One chained timeout loop per running world. No catch-up burst. Persist every 5 ticks by default, and on pause or shutdown. Restart restores sessions paused. |
| Tests | 7 files, 17 tests, passing on 10 October 2026. |
| Containers | Server image runs as `node` and migrates before start. Web image is a static build served by nginx. Public ports are bound to `127.0.0.1`. |

`npm test` and `npm run typecheck` are the automated checks. There is no lint or format script.

## Clock and calendar

The authoritative value is still the integer tick. In-game time is a conversion of that tick, which is the variation chosen for this project.

- `TICK_INTERVAL_MS` defaults to 1000. That is the real time between ticks.
- `TICK_GAME_SECONDS` defaults to 3600. One tick is one in-game hour. Set it to 60 for one minute, or 1 for one second.
- The server stores `game_day` (starting at 1), `game_hour` (0–23), `game_minute`, and `game_second` on every advanced tick.
- A new world begins at tick 0, day 1, 00:00:00.
- The page treats 365 days as a year and shows year progress and a 24-hour day bar from the stored clock.
- A 30-day month is calculated in the browser for the console log only. It is not stored.
- Seasons are later. The season labels on the dashboard are placeholder text.

Changing `TICK_GAME_SECONDS` changes the meaning of every existing tick, because the clock is derived rather than recorded as a separate timeline.

## Live interface and reference layout

The first three panels (connection, world session, and clock) were replaced by the EON dashboard. The old panel files remain under `apps/web/src/features/` for reference.

These parts are wired:

- Top-bar connection status, protocol version, and phase
- Create World and Load world
- Play and pause, both in the top bar and on the timeline
- The timeline clock, day bar, and year progress
- The header year and day-of-year
- The error dialog for failed commands

These parts are kept for later development and do not affect the simulation:

- Delete Current World, Step, the speed label, notifications, settings, and the side navigation
- Population, food, wood, stone, animals, happiness, tasks, world status, the selected item, and recent events
- The season and the fixed `10:24` under the header clock

## Checks against the plan

- Client, server, and PostgreSQL match the documented architecture.
- A checkout installs from the lockfile.
- Compose starts the database, server, and site.
- Migrations apply on a fresh database.
- A session receives a stable UUID and can be loaded again.
- The server owns start, pause, resume, and the tick.
- State survives a normal restart, and the session comes back paused.
- Reconnect and a second client share one runtime.
- Automated tests pass, and no AI service is required.
- README and the docs in this folder describe the commands and the limits.

The optional `GET /api/worlds/:id` route was not added. World inspection uses the socket.

## Limits that remain

- No authentication. The service is for a trusted machine or a trusted LAN.
- A crash can lose ticks since the last persist. The default interval is 5 ticks.
- Create always inserts a new world. The browser remembers the last id in `life-simulator:last-world-id`.
- The create and load forms are hidden while a session is already open. The dialog then shows that session, including its id.
- The map viewport does not render a world.
- The month length and the year length are display math and do not share a boundary.

## Not started

Phase 1 and later are untouched: procedural terrain, water, plants, animals, people, resources, needs, settlement behavior, and AI. The reference cards show those ideas as static numbers so the layout can be reused. They are not simulation state.
