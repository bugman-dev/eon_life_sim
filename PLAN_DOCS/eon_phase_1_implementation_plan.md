# EON — Phase 1 Implementation Plan
**Phase:** 1 — World Foundation  
**Status:** Ready for implementation  
**Predecessor:** Phase 0 — Foundation  
**Primary outcome:** A seeded, persistent, procedurally generated world that the server owns and the browser can inspect in the 2D viewport.

---

## 1. Purpose

Phase 0 established the application shell: React/Vite client, Node.js/Fastify server, PostgreSQL persistence, WebSocket protocol, world sessions, and an authoritative simulation clock.

Phase 1 adds the first actual world. It must create a coherent environment from a seed, persist it, and render it in the existing viewport. This phase is about **world generation and world representation**, not life simulation.

The world should be structured so later phases can add entities, needs, movement, ecology, and settlement behavior without replacing the Phase 1 foundation.

## 2. Goals

By the end of Phase 1:

1. Every world has a stable seed and explicit world-generation configuration.
2. The server generates a finite 2D grid with coordinates and terrain.
3. Terrain forms plausible contiguous regions rather than independent random tiles.
4. Water features are represented explicitly.
5. Vegetation and resource deposits are generated from terrain and environmental rules.
6. Soil/environmental attributes are represented where useful for future farming and ecology.
7. Generated data is stored in PostgreSQL and can be loaded after refresh or server restart.
8. The browser renders the generated map through the existing PixiJS viewport.
9. Re-running generation with the same seed and configuration produces the same logical world.
10. Tests cover generation invariants, seed determinism, persistence, and client rendering integration.

## 3. Out of scope

Do **not** implement these in Phase 1:

- Human or animal population.
- NPC needs, jobs, decisions, memories, relationships, or AI.
- LLM/Ollama/API integration.
- Farming simulation, plant growth over time, resource consumption, crafting, or economy.
- Weather, seasons, day/night effects, climate simulation, disasters, or advanced erosion.
- Multiple settlements, migration, culture, or history.
- Qdrant, Redis, or other infrastructure not needed for this phase.
- A 3D renderer or a replacement for React/PixiJS.
- Elaborate biome simulation requiring a climate model.

Static vegetation and resource deposits are **world features**, not active living entities in this phase.

## 4. Design principles

- **Server authority:** generation and canonical world data are created and validated on the server. The client is a viewer/controller.
- **Seed determinism:** randomness must come from a seeded random-number generator. Do not use unseeded `Math.random()` in generation code.
- **One source of truth:** PostgreSQL stores canonical generated world data. Client-side rendering caches are disposable.
- **Layered data:** terrain, water, soil, vegetation, and deposits are distinct concepts, even if stored efficiently together.
- **Small first world:** begin with a modest grid that is easy to inspect and test; make dimensions configurable within validated limits.
- **Deterministic rules before realism:** use explainable generation steps rather than adding complex simulation too early.
- **Stable contracts:** shared types/schemas define what the server sends to the browser.
- **No premature optimization:** start with a single world payload. Add chunking only if measurements show that it is necessary.
- **Keep Phase 0 stable:** extend the existing architecture and protocol; do not redesign the stack.

## 5. Recommended first-world defaults

These are implementation defaults, not permanent design limits. Keep them configurable.

| Setting | Initial value | Rationale |
|---|---:|---|
| Grid width | 128 tiles | Large enough to show regions, small enough for a simple initial payload |
| Grid height | 128 tiles | Produces 16,384 tiles |
| Tile size in world units | 1 | Keeps coordinates intuitive |
| Default seed | Generated once at world creation | Each new world can differ; the stored seed makes it reproducible |
| Generation version | `1` | Allows future generator changes to be identified |
| World shape | Finite rectangular grid | Simple bounds and rendering |
| Coordinate origin | Top-left tile is `(0, 0)` | Matches screen/grid conventions |
| Rendering | Orthographic 2D tile map | Fits the existing PixiJS viewport |

If performance or usability tests suggest a different grid size, adjust it before locking the public contract. Avoid an unbounded world in Phase 1.

## 6. World model

### 6.1 World-generation metadata

Add a world-generation metadata structure associated with each world session:

- `worldId`
- `seed` — persist as a string or another representation that safely supports the chosen seed range
- `generationVersion`
- `width`
- `height`
- `tileSize`
- `createdAt` / generation timestamp, if not already provided by the session
- Optional `generatorConfig` JSON for validated parameters that materially affect generation

The existing world-session seed should be reused if it already serves this purpose. Do not introduce a second seed field with a different meaning.

A generation version is important: the same seed only guarantees the same result when the generation algorithm and its relevant configuration are also the same.

### 6.2 Tile data

Each tile has integer grid coordinates and canonical environmental attributes.

Minimum logical fields:

- `x`, `y`
- `terrainType`
- `elevation` or a comparable numeric height value
- `waterType` or `isWater` where water is present
- `soilType` or a small set of soil-quality attributes
- `vegetationType` / vegetation density
- Resource deposit entries, if any

Recommended terrain types for the first pass:

- `deep_water`
- `shallow_water`
- `sand`
- `grassland`
- `forest`
- `rocky`
- `mountain`

Do not force all visual or gameplay distinctions into `terrainType`. For example, a forest is vegetation on land, not necessarily a different geological surface. If the current implementation needs a single visual category per tile, derive that category from the separate attributes for rendering.

Recommended water types:

- `none`
- `lake`
- `river`
- `coast` or `ocean`

Keep the set small and explicit. Rivers can be simplified in Phase 1; realistic hydrology is not required.

Recommended soil fields:

- `soilType` such as `poor`, `normal`, or `fertile`
- `fertility` as a bounded numeric value, if it helps future agriculture

Recommended resource deposit types:

- `wood` should generally be derived from vegetation/trees rather than a mineral deposit.
- `stone`
- `ore` (optional in the first implementation)
- `clay` (optional)
- `fresh_water` should be represented by water features, not a duplicate mineral-style deposit.

Do not implement resource harvesting or changing stock quantities yet. These are static starting-world deposits.

### 6.3 Keep entities separate

Phase 1 does not need a full ECS or entity system. A tree can initially be represented as a vegetation feature or tile attribute. Design the schema so a later phase can migrate individual trees, animals, people, and objects into entities without treating every tile as an entity.

## 7. Generation pipeline

Generation should be a deterministic pipeline with small, independently testable stages. The exact algorithm can be refined during implementation, but preserve the stage boundaries.

### Stage 1 — Validate configuration

Validate seed, dimensions, generation version, and all configurable parameters. Reject dimensions that exceed the chosen safe maximum. Do not silently accept malformed values.

### Stage 2 — Create deterministic random streams

Use a documented seeded PRNG. Prefer separate derived random streams for major stages (for example, elevation, water, vegetation, deposits). This reduces accidental changes across the whole world when one stage is edited.

Never rely on iteration order from an unstable collection, wall-clock time, or unseeded randomness.

### Stage 3 — Generate elevation

Generate a smooth elevation field using a coherent noise technique or another deterministic method. Avoid independent per-tile random elevations, which usually look like visual static.

The first implementation can use a small number of octaves or a simpler value-noise approach. No external generation service is needed.

### Stage 4 — Classify land and water

Use elevation thresholds to define deep water, shallow water, and land. Ensure the default map contains a useful amount of walkable land. Exact percentages should be tested and tuned rather than assumed to be universal.

A basic coast/lake model is sufficient. Do not promise realistic watersheds or river flow in this phase.

### Stage 5 — Generate terrain and rocky regions

Classify land tiles into sand, grassland, rocky terrain, and mountain regions using elevation and deterministic local variation. Use neighborhood smoothing or region rules to avoid isolated single-tile noise everywhere.

### Stage 6 — Generate soil

Assign soil type/fertility from terrain and deterministic variation. Fertile soil should be more likely in suitable lowland/grassland areas; mountains and exposed rocky areas should generally be less fertile. These are initial-world attributes only.

### Stage 7 — Generate vegetation

Place forest patches and other vegetation using terrain suitability and spatial clustering. Avoid trees/forest on deep water and high mountains. Keep vegetation separate from the underlying terrain classification in canonical data.

### Stage 8 — Generate resource deposits

Place static stone and optional ore/clay deposits according to terrain suitability. Deposits should be spatially clustered enough to read as regions, but not guaranteed to appear in every world. Resource rules must be deterministic.

### Stage 9 — Validate the generated world

Run invariant checks before persisting:

- Tile count equals `width × height`.
- Every coordinate is unique and within bounds.
- Every tile has valid enum values and bounded numeric attributes.
- Water and land attributes are consistent.
- No forbidden vegetation/deposit combinations exist.
- Seed and generation version are recorded.
- Required map-level sanity checks pass.

If generation fails validation, return a structured server error and do not leave a partially generated world marked as ready.

### Stage 10 — Persist atomically

Persist generation metadata and tile data in a transaction or equivalent all-or-nothing operation. A world must not appear generated until its full map is stored successfully.

### Stage 11 — Return a client map representation

Return the minimum data needed to render and inspect the world. If the initial payload becomes too large, add a bounded map/chunk request after measuring it; do not build a complex streaming protocol pre-emptively.

## 8. Persistence design

First inspect the existing migrations and repository patterns. Extend them rather than creating a parallel persistence system.

A reasonable starting design is:

- `world_generation` (or equivalent): one row per world, including seed, generation version, dimensions, and configuration.
- `world_tiles`: one row per tile, keyed by `(world_id, x, y)`, with tile attributes and optional JSONB for a small number of evolving attributes.
- Optional `world_resource_deposits`: use a separate table if deposits can be multiple per tile or need independent quantities/metadata.

Choose relational columns for frequently queried fields and constraints. JSONB is appropriate for limited flexible metadata, not as an excuse to store the entire world as an opaque blob.

Required constraints:

- Foreign keys to the world session.
- Unique `(world_id, x, y)`.
- Valid ranges and non-null fields where applicable.
- Indexes for world lookup and any query used by the initial renderer.

The map generation write should be transactional. World loading must return the saved map and must not silently regenerate a missing map for an existing world. If a legacy Phase 0 world has no generated map, provide an explicit migration/upgrade behavior: either generate its map once from its stored seed and mark the generation version, or show a clear “world not generated yet” state. Pick one behavior and test it; do not let map loading create different results on each request.

## 9. Server architecture and API integration

Follow the existing `apps/server`, `apps/web`, and `packages/shared` workspace boundaries.

### Server responsibilities

- Own generation configuration and seed interpretation.
- Run the generation pipeline.
- Validate generated output.
- Persist and load world data.
- Publish the canonical map to connected clients.
- Return structured errors for invalid configuration, persistence failure, or invalid map data.

### Shared package

Add shared TypeScript types and Zod schemas for:

- World-generation metadata.
- Tile and resource enums.
- Map payload / map summary.
- Any new client command and server event.

Validate both incoming commands and outgoing payload construction at the boundary. Keep protocol versioning consistent with the Phase 0 convention.

### WebSocket protocol

Reuse the current world-session flow where practical. Decide explicitly whether map data is included in `world.get`/the initial session state or retrieved through a separate command such as `world.map.get`.

Prefer the simplest protocol that matches current code. If map data is sent separately, include the world ID, dimensions, seed, generation version, and payload so the client can reject stale data belonging to a different world.

Do not send a full map on every clock tick. The map is static in Phase 1; send it on initial load and only send later updates when map data actually changes.

### World creation behavior

Define whether `world.create` generates the map immediately or creates the session first and then generates the map. The recommended behavior is:

1. Validate request.
2. Create or reserve the session ID and seed.
3. Generate and validate the map.
4. Persist metadata and map atomically, with clear rollback/error behavior.
5. Return a world-ready response and map data (or map-ready event).

Avoid a state where the client believes a world is ready while its map is only partially stored.

## 10. Browser and PixiJS implementation

Keep PixiJS isolated behind the existing viewport component. React owns UI state; PixiJS owns drawing. The server remains authoritative.

### Required rendering behavior

- Render every tile at the correct grid coordinate.
- Use a stable palette or simple procedural colors for terrain categories.
- Show water clearly and distinguish shallow/deep water if both are represented.
- Show forest patches and resource deposits at a readable zoom.
- Support pan and zoom if the current viewport foundation makes this reasonable; if not, at minimum fit the full map and avoid clipping.
- Show loading, empty, and error states.
- Display world seed and dimensions somewhere in the world information UI.
- Do not use the placeholder dashboard statistics as if they were live simulation data.

### Rendering constraints

- No external art assets are required for Phase 1.
- Do not draw one React component per tile. Use PixiJS graphics or a batched representation.
- Avoid recreating the entire PixiJS application on every React render.
- Destroy or clean up PixiJS resources on unmount/world switch.
- Do not redraw the map every simulation tick when its data has not changed.

### Visual acceptance

A user should be able to tell at a glance where the land, water, forest, mountains, and resource-rich areas are. The result can be stylized and simple; it must be legible and internally consistent, not photorealistic.

## 11. Implementation sequence

Work in small commits and keep the stack runnable after each step.

### Step 1 — Inspect and document current contracts

- Review world-session schema, migrations, shared protocol schemas, WebSocket dispatcher/gateway, repository interfaces, and `PixiViewport`.
- Identify the existing seed field and how create/load responses work.
- Decide where map data enters the current client flow.
- Record the agreed tile model and configuration defaults before coding.

**Exit check:** No duplicate world ID/seed concept and no unnecessary protocol redesign.

### Step 2 — Define shared world types

- Add terrain, water, soil, vegetation, and deposit types.
- Add world metadata and tile/map schemas.
- Add validation limits for dimensions and numeric attributes.
- Add unit tests for valid and invalid payloads.

**Exit check:** Shared schemas reject invalid coordinates, dimensions, enums, and out-of-range values.

### Step 3 — Implement seeded random utilities

- Select and document a deterministic PRNG implementation.
- Add helpers for deriving independent streams from the world seed and stage name.
- Add tests proving the same seed/stream produces the same sequence.
- Ensure all generation functions receive randomness explicitly.

**Exit check:** No unseeded randomness is used by world generation.

### Step 4 — Implement pure generation stages

Implement and test elevation, water classification, terrain classification, soil, vegetation, and deposits as pure functions where practical.

- Keep each stage focused.
- Avoid database or WebSocket dependencies in generator code.
- Add map-level validation.
- Add a small deterministic fixture for regression tests.

**Exit check:** Generation can run in a unit test without PostgreSQL, browser, or network.

### Step 5 — Add database migration and repository methods

- Add schema/migration for metadata and tiles.
- Add transactional save/load methods.
- Enforce uniqueness and foreign keys.
- Test save/load round-tripping and failure rollback.

**Exit check:** Persisted map equals generated logical map after reload.

### Step 6 — Integrate world creation and loading

- Connect generator to the existing world-session service.
- Ensure world creation yields a generated, persisted map.
- Ensure loading retrieves the saved map.
- Handle Phase 0 worlds with no map using the explicitly chosen upgrade behavior.
- Add structured errors and avoid partially ready worlds.

**Exit check:** Create, reload, and restart preserve the same seed and map.

### Step 7 — Extend shared protocol and server delivery

- Add or extend the message/event schema.
- Wire map retrieval into dispatcher and gateway.
- Avoid sending map payloads on clock updates.
- Ensure stale map responses cannot replace the currently selected world’s map.

**Exit check:** Browser receives the right map for the active world and reconnect/load works.

### Step 8 — Render in PixiJS

- Replace the empty viewport with a tile renderer.
- Add terrain/water/vegetation/deposit visuals.
- Add loading/error/empty states.
- Add fit-to-map and basic pan/zoom if straightforward.
- Verify cleanup when changing worlds or unmounting.

**Exit check:** The generated world is readable in the dashboard without fake placeholder data.

### Step 9 — End-to-end verification

- Run automated tests and type checking.
- Start the stack with Docker Compose.
- Create a new world and record its seed.
- Reload it, refresh the browser, and restart the server.
- Confirm the world is unchanged and returns paused according to Phase 0 behavior.
- Create another world with a different seed and inspect that it is not a duplicate by default.
- Confirm no AI service is required.

**Exit check:** All Phase 1 acceptance criteria below pass.

## 12. Testing plan

### Unit tests

**Seed and randomness**
- Same seed and generation version produce identical output.
- Different seeds generally produce different maps.
- Invalid seeds/configuration fail clearly.
- Generator does not use wall-clock time or unseeded random values.

**Grid and coordinates**
- Tile count equals width × height.
- Every coordinate occurs exactly once.
- Coordinates remain inside bounds.
- Dimensions at supported minimum/maximum work; out-of-range dimensions fail.

**World invariants**
- No water tile is classified as forest.
- No impossible terrain/vegetation combinations.
- Numeric fields stay within configured ranges.
- Resource deposits only occur on eligible terrain.
- Map-level water/land sanity checks catch all-water or all-land outputs if those violate chosen defaults.

**Persistence**
- Save/load round trip preserves all canonical fields.
- Duplicate coordinates are rejected.
- Failed transaction does not leave a partially generated map.
- A world without a map follows the explicit legacy-world behavior.

### Integration tests

- Creating a world generates and persists the map.
- Loading a world returns the same map and metadata.
- WebSocket payloads satisfy shared schemas.
- Browser receives map data for the active world.
- Clock updates do not retransmit the full map.
- Reconnect and server restart preserve map data.
- A persistence failure returns a clear error and does not report success.

### Manual checks

- Run `npm test` and `npm run typecheck` using the repository's documented commands.
- Start the Docker Compose stack.
- Create at least three worlds and compare seeds/maps.
- Reload the same world and confirm no visual changes.
- Inspect the map at full extent and at zoomed-in scale.
- Verify the map is usable at the default dimensions on the development machine.

Do not mark tests as passed until they have actually been run in the current checkout.

## 13. Phase 1 definition of done

Phase 1 is complete when all items below are true:

- [ ] A world has a stable seed and generation version.
- [ ] World dimensions are validated and persisted.
- [ ] Procedural generation creates a complete, coherent tile grid.
- [ ] Terrain and water are represented separately enough for future simulation.
- [ ] Soil attributes exist for future ecology/agriculture.
- [ ] Vegetation and static resource deposits follow deterministic suitability rules.
- [ ] Same seed + same generation version/configuration yields the same logical world.
- [ ] Different seeds can yield meaningfully different worlds.
- [ ] Generation data is persisted transactionally in PostgreSQL.
- [ ] Loading an existing world does not regenerate a different map.
- [ ] The browser renders the map using the existing PixiJS viewport.
- [ ] The renderer has loading/error states and cleans up correctly.
- [ ] Shared schemas and protocol validate map data.
- [ ] Automated tests and type checking pass.
- [ ] Docker Compose end-to-end checks pass.
- [ ] No AI service is required.
- [ ] Documentation explains generation settings, seed behavior, data model, and verification commands.

## 14. Risks and decisions to keep explicit

| Risk | Mitigation |
|---|---|
| A generator change alters existing worlds | Store `generationVersion`; never silently regenerate saved maps |
| Large map payload slows browser | Start with 128×128; measure before adding chunks |
| Random generation looks noisy | Use coherent elevation fields, clustering, and neighborhood rules |
| Map and session persistence disagree | Save generation data transactionally and define world-ready semantics |
| Tile model becomes too rigid | Separate geological terrain from water, soil, vegetation, and deposits |
| Legacy Phase 0 worlds have no map | Choose and test an explicit upgrade behavior |
| Rendering leaks resources on world switch | Keep PixiJS lifecycle/cleanup in the viewport component |
| Scope expands into ecology simulation | Keep vegetation/deposits static until later phases |

### Decisions required during Step 1

Resolve these by inspecting the repository and documenting the decision before implementation:

1. Reuse the existing world-session seed field or add metadata that references it; avoid two competing seeds.
2. Choose the exact terrain/water/soil enums and numeric ranges.
3. Choose whether legacy Phase 0 worlds get generated maps on first load or show an explicit not-generated state.
4. Decide whether map data is bundled with the initial world response or delivered through a separate map message.
5. Confirm the default grid dimensions and maximum supported dimensions.

These decisions should be made with the current source code open; this plan does not assume uninspected repository details.

## 15. Deferred hardening items

The following Phase 0 medium-priority items are intentionally deferred until after Phase 1, as agreed:

- WebSocket room subscription cleanup when switching worlds.
- Stricter behavior for periodic persistence failures.
- Broader tick-rate/speed-control terminology and behavior.

Do not let these items expand Phase 1 scope unless one directly prevents the new map flow from working correctly.

## 16. Commands and delivery notes

Use the repository's existing scripts rather than inventing new command names. The Phase 0 report identifies:

```bash
npm test
npm run typecheck
```

Use the documented Docker Compose command in the repository README/development guide for the full-stack check.

Suggested commit boundaries:

1. `feat(world): define world generation schemas`
2. `feat(world): add deterministic generator`
3. `feat(world): persist generated maps`
4. `feat(protocol): deliver world map data`
5. `feat(viewport): render generated world`
6. `test(world): cover deterministic generation and persistence`
7. `docs(world): document Phase 1 generation`

The commit names are suggestions, not requirements. Keep each commit small enough to review and revert independently.
