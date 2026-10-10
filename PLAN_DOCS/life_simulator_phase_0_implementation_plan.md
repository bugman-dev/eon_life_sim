# Life Simulator — Phase 0 Implementation Plan
**Document type:** Engineering implementation plan  
**Status:** Implemented. The as-built record is [docs/phase-0-report.md](docs/phase-0-report.md). This file remains the original plan.  
**Scope:** Foundation only; no actual world simulation or AI behavior yet

---

## 1. Purpose

Phase 0 establishes a reliable technical foundation for the Life Simulator. When Phase 0 is complete, the browser must be able to connect to the headless simulation server, create or open a world session, receive the authoritative simulation state, and observe a simulation clock advancing. The server must persist the session's foundational state in PostgreSQL.

This phase is deliberately small. It proves the end-to-end architecture before we build procedural terrain, living entities, survival needs, or autonomous settlement behavior.

### Phase 0 completion outcome

A working vertical slice:

1. Start the services using Docker Compose.
2. Open the browser client.
3. Connect to the backend over WebSocket.
4. Create a new world session.
5. See the world's ID, connection status, simulation tick/time, and running/paused state.
6. Start, pause, and resume the simulation clock.
7. Refresh the browser and reconnect to the same persisted world session.
8. Confirm that the backend—not the browser—owns the authoritative state.

> **Phase 0 proves the plumbing. It does not prove that a village can develop.**

---

## 2. Guiding principles

1. **Server-authoritative simulation:** the backend owns world state, simulation time, and future entity state. The browser is a viewer/controller.
2. **AI is not a dependency:** Phase 0 must run without Ollama, Qwen, Claude, OpenAI, Qdrant, or Redis.
3. **One source of truth:** PostgreSQL stores persistent authoritative data. Do not add a vector database or cache at this stage.
4. **Small, testable increments:** build and verify one vertical slice at a time.
5. **Clear boundaries:** rendering, networking, simulation rules, persistence, and API validation should not be tangled together.
6. **Deterministic foundations:** use explicit simulation ticks and a controllable clock rather than relying on browser frame rate.
7. **Do not overbuild:** no microservices, Kubernetes, Redis, event bus, or premature performance optimization.
8. **Document reality:** record commands actually run, configuration decisions, test results, and issues encountered in the ongoing setup guide.

---

## 3. Scope

### Included

- Repository and workspace setup
- React + TypeScript client
- PixiJS installed and isolated behind a rendering module
- Node.js + TypeScript backend
- HTTP health endpoint
- WebSocket connection and typed message protocol
- PostgreSQL database in Docker Compose
- Database migration mechanism
- World-session creation and retrieval
- Minimal persistent world/session metadata
- Simulation clock with start, pause, and resume
- Basic logging, configuration validation, error handling, and tests
- Development instructions and a first deployment path on the headless server

### Explicitly excluded

- Procedural map or terrain generation
- Plants, trees, animals, humans, buildings, inventory, needs, or resources
- NPC AI, LLM calls, AI queue, or AI provider integration
- NPC memory, embeddings, Qdrant, and semantic retrieval
- Economy, farming, construction, families, reproduction, or society
- Advanced save slots, snapshots, rollback, or branching timelines
- Redis, Kubernetes, microservices, or distributed simulation
- Internet exposure, router port forwarding, or public-domain configuration

Public internet access is not needed for this phase. Keep the service local to the trusted development network until authentication and deployment security are addressed in a later operational phase.

---

## 4. Architecture

```text
┌────────────────────────────── Browser ──────────────────────────────┐
│ React UI                                                            │
│  ├─ Connection/status panel                                         │
│  ├─ World session controls                                          │
│  └─ Simulation clock display                                        │
│                                                                     │
│ Client networking layer ─────────────── WebSocket / HTTP ───────┐   │
└──────────────────────────────────────────────────────────────────│───┘
                                                                   │
┌──────────────────────────── Headless Server ──────────────────────▼──┐
│ Node.js + TypeScript                                                 │
│  ├─ HTTP routes: health and readiness                                │
│  ├─ WebSocket gateway: protocol validation and client messages       │
│  ├─ World-session service: create/load session                       │
│  ├─ Simulation runtime: tick, start, pause, resume                   │
│  ├─ Persistence/repository layer                                     │
│  └─ Structured logs and error handling                               │
│                              │                                       │
│                              ▼                                       │
│                         PostgreSQL                                   │
│                 persistent world/session metadata                    │
└──────────────────────────────────────────────────────────────────────┘

Future, not part of Phase 0:
Headless server ── AI provider interface ── AI server (Ollama/Qwen)
                                      └──── External API provider
```

### Component responsibilities

**Browser client**
- Renders status and controls.
- Sends user intent such as create world, start, pause, or resume.
- Displays state received from the server.
- Does not independently advance authoritative simulation time.
- Does not write directly to PostgreSQL.

**Backend**
- Validates incoming commands.
- Owns the simulation clock and session lifecycle.
- Sends authoritative state updates to connected clients.
- Writes persistent session metadata to PostgreSQL.
- Remains the authority if multiple browser clients connect.

**PostgreSQL**
- Stores persistent world-session records and minimal simulation metadata.
- Is the source of truth for data that must survive a server restart.
- Is accessed only through the backend's persistence layer.

**PixiJS**
- Is installed and wrapped behind a client rendering boundary.
- Does not need to render a world in Phase 0.
- Will be used in a later phase to render terrain and entities.

---

## 5. Recommended technical choices

| Area | Phase 0 choice | Reason |
|---|---|---|
| Language | TypeScript throughout | Shared types and fewer interface mismatches |
| Client | React + Vite | Fast local development and simple build |
| Rendering | PixiJS | Suitable for a later 2D world; keep isolated initially |
| Backend | Node.js + TypeScript | Fits the planned systems and developer skills |
| HTTP framework | Fastify | Lightweight routing, validation, and plugin support |
| Real-time transport | WebSocket | Server can push simulation updates |
| Database | PostgreSQL | Durable authoritative state |
| Database access | A typed query layer such as `pg` plus migrations | Avoid hiding the schema behind excessive abstraction |
| Validation | A runtime schema validator such as Zod | TypeScript types alone do not validate network input |
| Testing | Vitest; add integration tests for DB/WebSocket | Quick unit and integration feedback |
| Containers | Docker Compose | Reproducible local and server services |
| Package manager | npm workspaces | Built-in workspace support without adding another tool |
| Logging | Structured server logs | Easier troubleshooting on a headless machine |

**Dependency rule:** choose exact stable package versions at implementation time, lock them in the lockfile, and record the Node.js version. Do not blindly copy version numbers from an old document.

---

## 6. Repository and folder structure

Use a small TypeScript monorepo so shared protocol types are defined once without merging client and server responsibilities.

```text
life-simulator/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── connection/
│   │   │   │   ├── world-session/
│   │   │   │   └── simulation-clock/
│   │   │   ├── rendering/
│   │   │   │   └── PixiViewport.tsx
│   │   │   ├── networking/
│   │   │   └── main.tsx
│   │   └── package.json
│   └── server/
│       ├── src/
│       │   ├── app.ts
│       │   ├── config/
│       │   ├── http/
│       │   ├── websocket/
│       │   ├── protocol/
│       │   ├── world-session/
│       │   ├── simulation/
│       │   │   ├── clock.ts
│       │   │   └── runtime.ts
│       │   ├── persistence/
│       │   │   ├── database.ts
│       │   │   ├── migrations/
│       │   │   └── world-session-repository.ts
│       │   └── observability/
│       └── package.json
├── packages/
│   └── shared/
│       └── src/
│           ├── protocol/
│           └── schemas/
├── infra/
│   └── docker/
├── docs/
│   ├── architecture.md
│   ├── development.md
│   └── decisions/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

This is a proposed starting layout, not a reason to create empty modules for every future feature. Create directories when the first real code needs them.

### Boundary rules

- `apps/web` may import public types and schemas from `packages/shared`.
- `apps/server` may import public types and schemas from `packages/shared`.
- `packages/shared` must not import browser-only or server-only modules.
- The web app must never import server persistence code.
- The simulation engine must not depend on React, PixiJS, or WebSocket implementation details.
- WebSocket handlers translate protocol commands into application/service calls; they do not contain simulation rules.
- Database queries live in the persistence/repository layer, not inside UI components or WebSocket handlers.

---

## 7. Initial data model

Keep the first schema intentionally small. Phase 0 does not need to model terrain or individual entities yet.

### `world_sessions`

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID primary key | Stable world-session identifier |
| `name` | text | Display name |
| `status` | text or constrained enum | `paused` or `running` |
| `simulation_tick` | bigint | Number of completed simulation ticks |
| `tick_rate` | integer | Target simulation ticks per simulated second, configurable |
| `seed` | bigint or nullable bigint | Reserved for deterministic world generation in Phase 1 |
| `created_at` | timestamp with time zone | Creation time |
| `updated_at` | timestamp with time zone | Last persisted update |

Do not store a running JavaScript timer or process handle in PostgreSQL. Those are runtime concerns. On server restart, restore the persisted session in a safe paused state unless a deliberate recovery policy is implemented and tested.

### Schema and data rules

- Use UUIDs for world-session identity.
- Use database migrations; do not rely on manual schema changes.
- Add constraints for valid status and non-negative tick values.
- Keep timestamps timezone-aware.
- Use parameterized SQL.
- Do not add tables for NPCs, memories, buildings, resources, or events until those concepts are implemented.
- Keep a distinction between **wall-clock time** and **simulation time**. A tick is a simulation unit; it is not inherently equal to one real-world second or one in-world day.

### Initial world session lifecycle

1. Client asks to create a session.
2. Server validates the name and optional seed.
3. Server creates a UUID and persists the initial paused session.
4. Server returns the authoritative session state.
5. Client can reconnect by session ID and retrieve the latest state.
6. Start/pause/resume commands update runtime state and persist the relevant metadata.

---

## 8. Simulation clock design

The clock is the first simulation subsystem. It must be separate from rendering and network transport.

### Requirements

- A single server-side runtime owns each active session's clock.
- Browser refreshes must not create a second clock for the same session.
- Pausing stops tick advancement.
- Resuming continues from the current tick.
- A slow tick must not create unlimited overlapping work.
- Clock status and tick count are broadcast to connected clients at a modest rate; do not send one network message for every internal operation.
- A server restart restores the persisted tick and starts paused.
- Time acceleration controls are not required beyond basic start/pause in Phase 0. The runtime should be designed so configurable speed can be added later.

### Clock implementation guidance

Use a server-side scheduler that calls a synchronous or explicitly bounded `advanceOneTick()` function. The function increments the tick and invokes registered systems in a defined order. In Phase 0, the only system may be a minimal clock/state update.

Avoid using `setInterval` as if it guarantees precise timing. JavaScript scheduling can drift under load. For Phase 0, a simple guarded loop or timer is adequate, provided it:
- prevents overlapping ticks,
- measures elapsed time,
- logs excessive lag,
- can be stopped cleanly,
- and does not attempt to “catch up” with an unbounded burst after a stall.

The simulation tick is authoritative; UI animation frames are not.

---

## 9. Client/server protocol

Define the protocol in `packages/shared` and validate incoming messages at runtime.

### Message envelope

Use a versioned message envelope so protocol changes are deliberate.

```ts
type ClientMessage =
  | { type: "world.create"; requestId: string; payload: { name: string; seed?: number } }
  | { type: "world.get"; requestId: string; payload: { worldId: string } }
  | { type: "simulation.start"; requestId: string; payload: { worldId: string } }
  | { type: "simulation.pause"; requestId: string; payload: { worldId: string } }
  | { type: "simulation.resume"; requestId: string; payload: { worldId: string } };

type ServerMessage =
  | { type: "hello"; protocolVersion: 1 }
  | { type: "request.ok"; requestId: string; payload: unknown }
  | { type: "request.error"; requestId: string; error: { code: string; message: string } }
  | { type: "world.state"; payload: WorldSessionState }
  | { type: "simulation.state"; payload: SimulationState };
```

This is illustrative. Replace `unknown` with concrete discriminated response types before production use. Validate all client input at runtime; compile-time types do not protect the server from malformed messages.

### Protocol rules

- Every command has a request ID.
- Every request receives either a success response or a structured error response.
- Include a protocol version in the initial handshake.
- Reject malformed, oversized, or unsupported messages safely.
- Do not send stack traces or secrets to the browser.
- The server sends authoritative state after commands and periodic clock updates.
- A client may request state, but it cannot set the tick count or write arbitrary state.
- Handle disconnects and reconnects without leaking timers or duplicate session runtimes.

### Initial HTTP endpoints

- `GET /health` — process is alive.
- `GET /ready` — application can serve requests and required database checks pass.
- Optional: `GET /api/worlds/:id` for basic inspection, if useful alongside WebSocket.

Health and readiness are different: the process can be alive while PostgreSQL is unavailable.

---

## 10. Docker and configuration

Use Docker Compose for reproducible development and initial deployment.

### Initial services

1. `web` — React development server in development; static build served by an appropriate web server for deployment.
2. `server` — Node.js backend.
3. `db` — PostgreSQL with a named persistent volume.

Keep PostgreSQL on the internal Compose network. Do not publish its port to the whole LAN by default. If host access is required for development, bind it to `127.0.0.1` and document why.

### Configuration

Create `.env.example` with placeholders such as:

```dotenv
NODE_ENV=development
SERVER_HOST=0.0.0.0
SERVER_PORT=3000
DATABASE_URL=postgresql://life_sim:replace_me@db:5432/life_sim
WEB_PORT=5173
```

Use a real secret in the untracked local `.env`; do not commit passwords. The example values are documentation, not production credentials.

### Container rules

- Use named volumes for PostgreSQL persistence.
- Add a database health check and make the server wait for database readiness or retry connection safely.
- Run schema migrations explicitly as part of a documented startup/deployment step.
- Avoid running the backend as root inside its container where practical.
- Pin base image versions and keep the lockfile committed.
- Do not use `docker compose down -v` unless you intentionally want to delete the database volume.
- Do not expose the backend or web app to the public internet during Phase 0.

---

## 11. Implementation sequence

Complete these in order. Each step has a clear acceptance check.

### Step 0.1 — Create the repository and tooling

**Work**
- Create the project repository.
- Initialize npm workspaces.
- Configure TypeScript, linting, formatting, and test scripts.
- Add `.gitignore`, `.env.example`, and a concise README.
- Record the Node.js and npm versions.

**Acceptance**
- A clean clone can install dependencies from the lockfile.
- Root scripts can run checks for all workspaces.
- No secrets, build output, or local environment files are committed.

### Step 0.2 — Scaffold the client

**Work**
- Create the React + TypeScript app with Vite.
- Add a basic page with connection status, world-session area, tick counter, and start/pause controls.
- Add a networking module rather than opening WebSocket connections inside arbitrary components.
- Install PixiJS and create a small rendering boundary/component, but do not build the world renderer yet.

**Acceptance**
- Client starts locally.
- The page renders without console errors.
- UI state is driven by application state, not direct DOM mutation.

### Step 0.3 — Scaffold the backend

**Work**
- Create the Fastify TypeScript server.
- Add configuration parsing and validation.
- Add `/health` and `/ready`.
- Add structured logs and graceful shutdown handling.

**Acceptance**
- Health endpoint responds.
- Invalid configuration fails with a clear startup error.
- Server shuts down without leaving background timers running.

### Step 0.4 — Add PostgreSQL and migrations

**Work**
- Add PostgreSQL to Docker Compose with a named volume.
- Add connection pooling and a repository boundary.
- Add the initial `world_sessions` migration.
- Add a migration command and document when it must be run.

**Acceptance**
- Database starts and passes its health check.
- Migration can be applied to a fresh database.
- Data survives a normal container restart.
- Server reports not-ready if required database connectivity is unavailable.

### Step 0.5 — Define shared protocol and validation

**Work**
- Add message types and runtime schemas in `packages/shared`.
- Implement request IDs, protocol version, success/error responses.
- Validate message type and payload on the server.
- Add message-size limits and safe error responses.

**Acceptance**
- Valid messages pass.
- Malformed and unsupported messages return structured errors.
- A malformed client message cannot crash the process.

### Step 0.6 — Implement world-session creation and retrieval

**Work**
- Implement create and get operations in the service layer.
- Persist session metadata through the repository.
- Return a complete authoritative state object.
- Ensure duplicate/retry behavior is safe enough for the simple initial workflow.

**Acceptance**
- A session receives a stable UUID.
- The client can retrieve the same session after refresh.
- The browser cannot choose its own authoritative tick count or status.

### Step 0.7 — Implement the simulation clock

**Work**
- Add the runtime and clock module.
- Implement start, pause, resume, and one-tick advancement.
- Guard against multiple clock loops for the same world.
- Persist tick changes at a controlled interval and on pause/shutdown.
- Restore sessions paused after server restart.

**Acceptance**
- Tick advances only while running.
- Tick stops while paused.
- Resume continues from the previous tick.
- Repeated start commands do not create duplicate loops.
- Refreshing the browser does not reset or duplicate the clock.

### Step 0.8 — Connect the browser end to end

**Work**
- Connect client to backend via WebSocket.
- Display connection status and world ID.
- Add create/load session controls.
- Add start/pause/resume controls.
- Render server-provided tick and status updates.
- Add reconnect handling and clear error states.

**Acceptance**
- User can create a session and observe the clock.
- User can pause/resume it.
- Disconnecting and reconnecting does not create a new world or clock accidentally.
- Two browser tabs viewing one session see the same authoritative tick/status.

### Step 0.9 — Add tests and operational documentation

**Work**
- Unit tests for clock state transitions and protocol validation.
- Integration tests for database persistence and session lifecycle.
- WebSocket tests for create/get/start/pause/resume.
- Update README and development guide with actual commands and known limitations.
- Record the tested startup and recovery procedure.

**Acceptance**
- Automated checks pass from a clean checkout.
- A fresh deployment can be started using documented steps.
- A restart/reconnect test demonstrates persisted session state.
- Phase 0 limitations are explicit.

---

## 12. Testing strategy

### Unit tests

- Clock increments exactly once per requested tick.
- Paused clocks do not advance.
- Start/resume is idempotent.
- A session cannot acquire multiple active clock loops.
- Invalid protocol payloads are rejected.
- Configuration validation rejects missing required values.

### Integration tests

- Create a world session and retrieve it from PostgreSQL.
- Persist a tick, restart the application, and verify the tick is restored.
- Verify the session starts paused after restart.
- Verify a database outage changes readiness status.
- Verify WebSocket requests return the expected success/error messages.

### Manual end-to-end test

1. Start services from the documented command.
2. Open the web UI in two browser tabs.
3. Create one world session in the first tab.
4. Load the same session in the second tab.
5. Start the clock and confirm both tabs show the same tick progression.
6. Pause and confirm ticks stop.
7. Refresh one tab and reconnect.
8. Restart the backend and confirm the persisted session returns paused at the saved tick.
9. Restart the database container normally and verify session data remains.
10. Confirm no AI service is required.

---

## 13. Operational and security baseline

Phase 0 is a development foundation, not a hardened public service.

- Bind services to the intended development interface only.
- Keep PostgreSQL off the public network.
- Do not configure router port forwarding or public DNS.
- Keep `.env` and credentials out of Git.
- Validate every message received over HTTP/WebSocket.
- Limit payload sizes and return safe errors.
- Log operational failures without logging credentials.
- Handle SIGTERM/SIGINT, stop clock loops, and close database connections.
- Use a non-root container user where practical.
- Document that the service currently assumes a trusted local network; add authentication and authorization before exposing it beyond that boundary.

---

## 14. Definition of Done

Phase 0 is complete only when all of the following are true:

- [x] The client, backend, and PostgreSQL are represented in the documented architecture.
- [x] The project installs reproducibly from a clean checkout.
- [x] Docker Compose starts the required services.
- [x] Database migrations work on a fresh database.
- [x] A world session can be created and retrieved.
- [x] The server owns the simulation clock.
- [x] Start, pause, and resume work correctly.
- [x] State survives a normal restart.
- [x] Browser reconnects do not duplicate the runtime.
- [x] Two clients observe the same server-authoritative state.
- [x] Unit and integration tests pass.
- [x] The system works with AI services completely absent.
- [x] README and setup notes describe verified commands and known limitations.

---

## 15. Risks and decisions to defer

| Risk or decision | Phase 0 approach |
|---|---|
| Choosing a full ECS framework too early | Start with modular systems and clear entity boundaries; evaluate ECS when actual entities arrive |
| Over-designing persistence | Store only world-session metadata until Phase 1/2 defines world and entity state |
| Tick scheduling complexity | Use a guarded, simple server-side clock; profile before optimizing |
| Too much client rendering work | Install and isolate PixiJS, but postpone world rendering |
| Premature AI integration | Do not connect AI until deterministic simulation behavior exists |
| Public access/security | Stay local; design authentication before external exposure |
| Database schema churn | Use migrations and small schema changes |
| Confusing real time with simulation time | Store an integer tick and define conversions explicitly when world-time rules are designed |

### Decisions required before implementation

Only a small number of choices must be fixed before coding:
1. The actual headless server's operating system and available Docker/Compose versions should be verified on that machine.
2. The project directory and Git repository location should be selected.
3. The intended development workflow should be chosen: develop on the main computer and deploy to the headless server, or edit/run directly on the server.

These are environment choices, not reasons to redesign the game.

---

## 16. Recommended execution workflow

For each implementation step:

1. State the objective and expected files.
2. Run one small set of commands.
3. Inspect the result before proceeding.
4. Run the acceptance check.
5. Record any error and its actual fix.
6. Update the setup documentation.
7. Commit the working step to Git.

Do not generate all project files in one large unverified operation. Incremental implementation makes failures easier to diagnose and keeps the repository understandable.

---

## 17. Final milestone

At the end of Phase 0, the project should be a small but real application:

- The backend runs on the headless server.
- PostgreSQL persists a world session.
- A browser connects to that backend.
- The browser can create or load a session and start/pause its clock.
- The server remains authoritative.
- The application can restart and recover safely.
- AI is not involved.

**Next phase after acceptance:** Phase 1 — World. Add deterministic procedural generation, coordinates, terrain categories, water, vegetation, resource deposits, and world seed handling on top of the proven foundation.
