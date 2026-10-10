# Architecture

Phase 1 has three processes. The browser displays state and sends intent. The Node server owns sessions, the simulation clock, and world generation. PostgreSQL stores session metadata and the generated map. No AI service is connected.

```text
Browser (React, Vite, PixiJS viewport, EON dashboard)
  WebSocket /ws
        |
Server (Fastify)
  HTTP /health and /ready
  gateway -> dispatcher -> world session service
                       -> world generator
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
- `world.delete` with `worldId`
- `simulation.start`
- `simulation.pause`
- `simulation.resume`

Create, load, start, pause, and resume receive `request.ok` with the world session, or `request.error` with a code and a message. `world.delete` replies with `world.deleted` and removes the session. Generation, tiles, and deposits follow that row through `ON DELETE CASCADE`. Clients that have loaded a session also receive `world.state` and, while the clock moves, `simulation.state`. Create and load also send one map message to that socket only:

- `world.map` with the world id, seed, generation version, dimensions, and tiles
- `world.map.unavailable` when the session has no generated map

Clock updates do not include tiles. A map for a different world id is ignored by the client.

A client cannot set the tick, the clock fields, the status, or the map. Tick values travel as decimal strings because they are 64-bit integers. If create omits a seed, the server assigns one safe integer and stores it on the session. That stored seed is the only seed.

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

## World generation

A new world is a finite grid. `WORLD_WIDTH` and `WORLD_HEIGHT` set that size, and both default to 128. Each side must be from 8 through 500. Generation version is `1`. The origin is the top-left tile `(0, 0)`. The generator lives in `apps/server/src/world` and does not import the database or the socket. Loading a world uses the size stored with its tiles.

Randomness is a mulberry32 stream hashed from the stored seed plus a stage name. Terrain placement uses that stream. The same seed, version, width, and height always rebuild the same tiles. Loading a saved world reads those tiles and does not generate again.

Terrain is `grass`, `dirt`, `sand`, or `water`. A new map is an island in the ocean: the border is water, the coast is irregular, and a sandy shore a few tiles wide follows that ocean. Grass covers most of the interior. Dirt is limited to small dry patches inland. A few rivers walk downhill from high ground until they meet a lake or the ocean. Each river is several tiles wide and broader near its mouth. Stored elevation stays 0. Vegetation and deposits stay empty for later. The white highland in reference art has no tile yet, so that ground stays grass.

Create generates the map and writes the session, generation row, tiles, and deposits in one transaction. A failed check or a failed write leaves no session. A world created before maps existed stays without a map until someone creates a new one.

## Browser calendar

The stored clock stops at day, hour, minute, and second. The page adds a display calendar:

- Elapsed days are `gameDay - 1`, so day 1 is the start of year 1.
- A year is 365 elapsed days. The header shows that year and the day within it.
- Year progress is the share of those 365 days, including the fraction of the current 24-hour day.
- The timeline bar is the share of the current day that has passed.
- A 30-day month is computed for the console log only.

Seasons are not part of this calculation. The season text on the page is placeholder copy.

## Dashboard

The page is the EON layout in `apps/web/src/app/Layout.tsx`. The PixiJS viewport fills the map area. The stat cards float over it. The error dialog opens above it.

Live pieces read the session, the map, and the socket status: the top connection readout, the world button and Create World dialog, both play/pause controls, the timeline clock, and the map. The world button shows the stored seed and, once a map has arrived, the dimensions. Server errors open `errorModal.tsx`. The dialog accepts a type of Error, Info, or Warning. Current failures use Error.

The viewport follows the PixiJS 8 application lifecycle: one `Application`, `resizeTo` the map area, and objects added to `app.stage`. The map is one `Container`. Each tile is a `Sprite` for grass, dirt, sand, or water, drawn once when the map arrives. Pan and zoom change that container. The simulation ticker does not redraw tiles. Switching worlds replaces the container children and destroys the previous sprites. Unmounting the page destroys the application.

A session with no map shows “This world has no generated map.” on the same full area.

The side navigation, stat cards, tasks, world status, selected item, recent events, step, delete, notifications, and settings are reference UI. Their numbers and labels are written in the components. They are there so later phases can replace them without rebuilding the shell.

## Persistence

`world_sessions` stores the id, name, `paused` or `running`, tick, tick rate, seed, timestamps, and the four clock columns. Status, tick, day, hour, minute, and second are constrained.

`world_generation` stores one row per generated world: version, width, height, and tile size. `world_tiles` stores one row per tile, unique on `(world_id, x, y)`. `world_resource_deposits` stores stone, ore, and clay. All three reference the session. Queries are parameterized. The browser never connects to PostgreSQL.

PostgreSQL is the only store. There is no Redis, queue, or vector database.
