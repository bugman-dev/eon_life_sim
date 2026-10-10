# Architecture

Phase 0 has three processes. The browser displays state and sends intent. The Node server owns sessions and the simulation clock. PostgreSQL stores session metadata. No AI service is connected.

```text
Browser (React, Vite, PixiJS viewport, EON dashboard)
  WebSocket /ws
        |
Server (Fastify)
  HTTP /health and /ready
  gateway -> dispatcher -> world session service
                       -> simulation runtime
                       -> PostgreSQL repository
```

`packages/shared` defines the protocol and the Zod schemas. The web app and the server both import it. Shared code does not import React, Fastify, or the database.

The web app does not import server persistence code. WebSocket handlers translate commands into service calls. Database queries stay in the repository. The simulation runtime does not depend on React, PixiJS, or the socket implementation.

## Protocol

Protocol version is 1. The server sends `{ type: "hello", protocolVersion: 1 }` when a socket opens. Client messages are limited to 16KB. Malformed, oversized, and unknown messages return `request.error` and do not crash the process. Stack traces and database credentials are not sent to the browser.

Commands, each with a `requestId`:

- `world.create` with `name` and an optional `seed`
- `world.get` with `worldId`
- `simulation.start`
- `simulation.pause`
- `simulation.resume`

Every command receives `request.ok` with the world session, or `request.error` with a code and a message. Clients that have loaded a session also receive `world.state` and, while the clock moves, `simulation.state`.

A client cannot set the tick, the clock fields, or the status. Tick values travel as decimal strings because they are 64-bit integers.

`world.state` carries the id, name, status, tick, game day, hour, minute, second, tick rate, seed, and timestamps. `simulation.state` carries the world id, status, tick, the four clock fields, and the tick rate.

There is no HTTP route for reading a world. Inspection goes through the socket. `GET /health` means the process is up. `GET /ready` also checks PostgreSQL.

## Clock

One runtime loop exists per running world. The loop uses a chained timeout, not `setInterval`. The next tick is scheduled only after the current tick finishes. A slow tick is logged and does not trigger a catch-up burst. Starting or resuming a world that is already running does not create a second loop. Resume uses the same path as start.

On startup the server marks any previously running session paused. Shutdown pauses running sessions and closes the database pool.

Each tick increments `simulation_tick` and then derives the clock:

```text
total in-game seconds = tick * TICK_GAME_SECONDS
day    = floor(total / 86400) + 1
hour   = the remainder, as hours, minutes, and seconds
```

Those four fields are written on the live session and persisted with the tick. The default `TICK_GAME_SECONDS` is 3600, so one tick is one hour and a day is 24 ticks.

## Browser calendar

The stored clock stops at day, hour, minute, and second. The page adds a display calendar:

- Elapsed days are `gameDay - 1`, so day 1 is the start of year 1.
- A year is 365 elapsed days. The header shows that year and the day within it.
- Year progress is the share of those 365 days, including the fraction of the current 24-hour day.
- The timeline bar is the share of the current day that has passed.
- A 30-day month is computed for the console log only.

Seasons are not part of this calculation. The season text on the page is placeholder copy.

## Dashboard

The page is the EON layout in `apps/web/src/app/Layout.tsx`. Children, including the empty Pixi viewport and the error dialog, render in the map area.

Live pieces read the session and the socket status: the top connection readout, the world button and Create World dialog, both play/pause controls, and the timeline clock. Server errors open `errorModal.tsx`. The dialog accepts a type of Error, Info, or Warning. Current failures use Error.

The side navigation, stat cards, tasks, world status, selected item, recent events, step, delete, notifications, and settings are reference UI. Their numbers and labels are written in the components. They are there so later phases can replace them without rebuilding the shell.

PixiJS is mounted in `apps/web/src/rendering/PixiViewport.tsx` and does not draw a world yet.

## Persistence

`world_sessions` stores the id, name, `paused` or `running`, tick, tick rate, optional seed, timestamps, and the four clock columns. Status, tick, day, hour, minute, and second are constrained. Queries are parameterized. The browser never connects to PostgreSQL.

PostgreSQL is the only store. There is no Redis, queue, or vector database.
