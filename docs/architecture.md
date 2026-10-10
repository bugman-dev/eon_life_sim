# Architecture

Phase 0 has three processes. The browser displays state and sends intent. The Node server owns sessions and the simulation clock. PostgreSQL stores session metadata.

```text
Browser (React, Vite, PixiJS viewport)
  WebSocket /ws and HTTP /health /ready
        |
Server (Fastify)
  gateway -> dispatcher -> world session service
                       -> simulation runtime
                       -> PostgreSQL repository
```

`packages/shared` defines the protocol and the Zod schemas. The web app and the server both import it. Shared code does not import React, Fastify, or the database.

The server accepts `world.create`, `world.get`, `simulation.start`, `simulation.pause`, and `simulation.resume`. Every command has a request id and receives `request.ok` or `request.error`. Connected clients that have loaded a session also receive `world.state` and `simulation.state`. A client cannot set the tick.

One runtime loop exists per running world. Starting an already running world does not create a second loop. The loop schedules the next tick only after the current tick finishes, and it does not burst ahead after a stall. On startup the server marks any previously running session paused.

PixiJS is mounted in `apps/web/src/rendering/PixiViewport.tsx` and does not draw a world yet.
