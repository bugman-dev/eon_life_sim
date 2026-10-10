# Life Simulator — Project Philosophy, Goal & Implementation Plan

## 1. Project Vision

Build a persistent, browser-based life simulation in which a small group of settlers develops autonomously into a functioning village over generations.

The user is a **god-like observer and external force**, not a conventional player character. The god observes the world and influences it through powers while inhabitants remain autonomous.

> **Create a world, set it in motion, and watch life figure itself out.**

The village is not a scripted progression. It may thrive, stagnate, migrate, split, recover from disasters, or die out depending on the world and its inhabitants.

---

## 2. Core Philosophy

### 2.1 Rule-based world

The simulation models the real world through abstractions rather than literal physical simulation.

Examples:
- Water has availability and can move through the environment.
- Plants grow through stages.
- Trees accumulate biomass.
- Resources can be extracted, regenerated, or depleted.
- Humans and animals have needs.
- Unmet needs affect health and can cause death.
- Disease can cause death if untreated.
- Humans and animals age and reproduce.
- Geography influences settlement and resource use.
- Knowledge can spread, develop, or be lost.

The goal is **realistic emergent behavior at an appropriate simulation scale**.

### 2.2 The god

The god:
- Observes the world.
- Uses UI controls and powers.
- Has unlimited power initially.
- Can manipulate the external world.
- Cannot directly control NPC free will.
- Cannot directly alter NPC natural development.
- Can create and destroy appropriate world entities.
- Can influence natural phenomena.

Initial powers may include:
- Create
- Destroy
- Kill
- Spawn animals/plants/resources
- Remove resources
- Rain
- Wind
- Lightning
- Fire
- Flood
- Other natural phenomena

The power system must be extensible.

NPCs do not know that the god exists. If they independently reason that some supernatural force exists, that is an emergent outcome.

### 2.3 Simulation owns reality

The headless game server is authoritative for:
- World state
- NPC state
- Animals
- Plants
- Resources
- Buildings
- Relationships
- Knowledge
- Memories
- History
- Population
- Economy
- Saves

> **The AI proposes. The simulation validates and executes.**

The AI can never directly modify authoritative state.

### 2.4 AI is not the foundation

Basic behavior works without an LLM:
- Eating
- Drinking
- Sleeping
- Seeking shelter
- Gathering
- Farming
- Hunting
- Building
- Reproduction
- Basic social behavior

AI is reserved for complex situations:
- Conflicting goals
- Novel situations
- Long-term planning
- Negotiation
- Important social decisions
- Complex interpretation
- Rich dialogue

The simulation must continue if the AI provider is unavailable.

### 2.5 AI-provider independence

The simulation uses an abstract AI-provider interface.

Possible providers:
- Ollama + Qwen3
- Claude API
- OpenAI API
- Other providers

Changing the provider must not require changing the simulation.

---

# 3. Data Ownership

## Headless server

Owns all persistent game data.

PostgreSQL is the authoritative store for:
- World
- Terrain
- Resources
- NPCs
- Animals
- Plants
- Buildings
- Relationships
- Skills
- Knowledge
- Memories
- Historical events
- Simulation state
- Save slots

## AI server

Performs inference.

Initial local setup:
```text
Ollama
  ↓
Qwen3
```

The AI server does not own NPC memory.

If semantic retrieval becomes necessary, Qdrant can be hosted on the headless server as an indexing/retrieval layer.

```text
PostgreSQL → authoritative facts/events/memories
Qdrant     → semantic retrieval index
AI         → uses selected context to reason
```

---

# 4. Simulation Entities

## Living
- Humans
- Animals
- Plants

## Physical
- Trees
- Rocks
- Water
- Resource deposits
- Soil
- Other environmental objects

## Constructed
- Houses
- Farms
- Storage
- Workshops
- Roads
- Other structures

The entity catalogue expands over time.

---

# 5. Plants and Trees

V1 does not require complex botanical species modeling.

Trees can initially simply be trees.

A tree contains:
- Age
- Growth stage
- Biomass
- Harvestable biomass
- Health
- Position

Growth stages determine biomass and harvest potential.

Example:
```text
Seedling → Young → Mature → Old
```

Other plants can be:
- Edible
- Non-edible
- Poisonous
- Harvestable
- Reproductive

Plant reproduction and regeneration can be expanded later.

---

# 6. Resources

Resources physically exist in the world.

### Renewable
- Rain/water
- Plants
- Trees
- Crops
- Fish
- Animal populations

### Slowly renewable
- Soil fertility
- Forests
- Groundwater

### Non-renewable
- Coal
- Iron ore
- Gold
- Other mineral deposits

Resources change through:
- Natural processes
- Harvesting
- Consumption
- Extraction
- God actions
- Environmental events

Initial resource simulation remains intentionally simple.

---

# 7. Animals

V1 includes several species with simple ecological roles:
- Herbivores
- Carnivores

Animals have:
- Species
- Position
- Age
- Health
- Hunger
- Thirst
- Energy
- Sex
- Reproduction

Animals can:
- Eat
- Drink
- Move
- Rest
- Hunt
- Flee
- Reproduce
- Die

V1 animal intelligence is deterministic.

---

# 8. Humans

Humans are the most sophisticated entities.

Each human can have:
- Identity
- Age
- Health
- Needs
- Personality
- Skills
- Knowledge
- Goals
- Intent
- Inventory
- Relationships
- Family
- Memories
- Position
- Occupation

Life cycle:
```text
Birth → Infant → Child → Teenager → Adult → Elder → Death
```

Children are fully simulated entities.

---

# 9. Needs and Health

Initial needs:
- Hunger
- Thirst
- Sleep/Energy
- Temperature/Exposure
- Shelter
- Health
- Injury
- Disease

Needs are continuous values rather than binary states.

Unmet needs affect other systems.

Example:
```text
Hunger
  ↓
Health decreases
  ↓
Energy decreases
  ↓
Work efficiency decreases
  ↓
Disease/death risk increases
```

Lack of shelter does not automatically cause death. Its consequences depend on climate, temperature, weather, clothing, health, injury, and duration.

---

# 10. Knowledge

Knowledge is a first-class simulation concept.

Initial settlers receive configurable starting knowledge, such as:
- Fire
- Hunting
- Basic farming
- Shelter construction
- Stone tools

Knowledge can be:
- Learned
- Practiced
- Taught
- Passed to future generations
- Discovered
- Forgotten
- Incorrect

NPCs can create knowledge through experimentation.

```text
Observation → Hypothesis → Experiment → Result → Knowledge
```

---

# 11. False Knowledge and Beliefs

NPCs can be wrong.

The simulation should eventually distinguish:
- Fact
- Knowledge
- Belief
- Technique
- Skill

False beliefs can spread, persist, and later be corrected.

This becomes important for future culture and AI reasoning.

---

# 12. Perception and Information

NPCs are not omniscient.

They perceive their environment and learn through:
- Observation
- Conversation
- Teaching
- Events
- Rumors
- Family communication
- Community interaction

Information can therefore propagate:

```text
Event
 ↓
Witness
 ↓
Conversation
 ↓
Other NPC
 ↓
Knowledge / belief
```

This supports future culture, religion, politics, and social systems.

---

# 13. Geography

Geography influences civilization without hardcoding outcomes.

Example:
```text
River → water → agriculture → settlement opportunity
```

```text
Mountain → mineral deposits → mining → metalworking
```

The simulation creates incentives and constraints; it does not force predefined civilization paths.

---

# 14. Actions

Use a unified action system.

```text
Action
├── Actor
├── Target
├── Location
├── Duration
├── Requirements
├── Effects
└── Interruption conditions
```

Examples:
- Move
- Eat
- Drink
- Sleep
- Gather
- Harvest
- Plant
- Hunt
- Build
- Talk
- Teach
- Trade
- Learn
- Attack

Actions can take time and be interrupted.

God powers should eventually use the same underlying action/event framework.

---

# 15. World Events

All meaningful world changes flow through the simulation.

Sources:
- Natural systems
- NPC actions
- God actions

Example:
```text
God clicks "Rain"
      ↓
God action
      ↓
Simulation event
      ↓
Weather/water systems
      ↓
World changes
      ↓
NPCs perceive change
      ↓
NPCs react
```

This provides one consistent event architecture.

---

# 16. Autonomous NPC Decision Architecture

NPCs do not directly decide whether to call an LLM.

A Decision Manager handles this.

```text
NPC situation
      ↓
Decision Manager
      │
      ├── Simple → Rules / Utility → Action
      │
      └── Complex → AI Queue → LLM
                              ↓
                       Proposed Action
                              ↓
                       Validation
                              ↓
                            Action
```

The conceptual decision pipeline is:

```text
Perception
    ↓
Needs + Goals + Knowledge
    ↓
Intent
    ↓
Candidate Actions
    ↓
Decision
    ↓
Validation
    ↓
Execution
```

---

# 17. Self-Sustaining Village

"Self-sustaining" is not an artificial game state.

The village survives because its underlying systems support it.

Examples:
```text
Food production >= consumption
Water availability >= consumption
Housing capacity >= population requirements
Long-term resource regeneration >= extraction
```

Temporary shortages are allowed.

A village may experience:
- Famine
- Drought
- Population decline
- Resource depletion
- Disease
- Death
- Migration
- Recovery
- Collapse

The simulation does not artificially protect successful settlements.

---

# 18. Implementation Phases

## Phase 0 — Foundation

### Objective
Create the application/server architecture.

Initial stack:
- React
- TypeScript
- PixiJS
- Node.js
- PostgreSQL
- WebSocket
- Docker

No AI dependency.

### Deliverable
Browser connects to the headless server and displays basic simulation/server state.

---

## Phase 1 — World

### Objective
Create a procedural world.

V1 uses procedural generation.

The world contains:
- Terrain
- Water
- Forests
- Basic plants
- Basic animals
- Resource deposits
- Soil
- Coordinates
- Simulation clock

World generation is deterministic from a seed.

### Deliverable
A generated world can be viewed, navigated, paused, and simulated.

---

## Phase 2 — Entities

### Objective
Introduce the fundamental entity model.

Implement:
- Plants
- Trees
- Animals
- Resources
- Humans
- Basic world objects

Introduce:
- Position
- Age
- Health
- Growth
- Basic state
- Inventory where appropriate

### Deliverable
Entities exist and change over simulation time.

---

## Phase 3 — Needs & Survival

### Objective
Make entities genuinely dependent on their environment.

Implement:
- Hunger
- Thirst
- Energy
- Temperature/exposure
- Shelter
- Health
- Injury
- Disease
- Death

Implement basic animal behavior and basic deterministic human behavior.

### Deliverable
Humans and animals can survive or die based on the world.

No AI.

---

## Phase 4 — Autonomous Settlement

### Objective
Allow initial settlers to form a settlement without player micromanagement.

Implement:
- Deterministic decision system
- Goals
- Candidate actions
- Utility scoring
- Movement
- Gathering
- Farming
- Hunting
- Shelter
- Storage
- Construction
- Basic jobs
- Families
- Reproduction
- Aging
- Children

Building decisions emerge from needs and resources rather than a scripted progression.

### Deliverable
Approximately 10 settlers can develop into a small settlement without direct control.

---

## Phase 5 — Economy & Knowledge

### Objective
Make the settlement economically and intellectually meaningful.

Implement:
- Resource production
- Consumption
- Inventory
- Basic trade
- Occupations
- Skill development
- Knowledge
- Teaching
- Learning
- Discovery
- Experimentation
- Knowledge inheritance
- Basic social relationships

Initial settlers have predefined knowledge. New knowledge can emerge through experimentation.

### Deliverable
A settlement can develop specialization and acquire knowledge over generations.

---

## Phase 6 — Society & History

### Objective
Create persistent individuals and communities.

Implement:
- Relationships
- Families
- Reputation
- Social groups
- Community decisions
- Historical events
- Individual memories
- Village history
- Communication
- Information propagation
- Basic false beliefs

### Deliverable
The village develops a recognizable social history.

---

## Phase 7 — AI Reasoning

### Objective
Introduce LLM reasoning where deterministic systems become insufficient.

```text
NPC situation
      ↓
Decision Manager
      ↓
Simple?
  /       Yes        No
 ↓          ↓
Rules      AI Queue
             ↓
        AI Provider
             ↓
      Proposed Action
             ↓
         Validation
             ↓
           Action
```

AI candidates:
- Complex personal decisions
- Conflicting goals
- Novel situations
- Negotiation
- Long-term plans
- Important social decisions
- Complex interpretation
- Dialogue

Initial local provider:
```text
Ollama → Qwen3
```

The provider remains replaceable.

### Deliverable
NPCs remain deterministic at the basic level while selected decisions gain richer reasoning.

---

## Phase 8 — Advanced Memory & Emergence

### Objective
Make individual lives and village history deeply persistent.

Implement:
- Long-term memory
- Semantic memory retrieval
- Important-event weighting
- Historical retrieval
- Better AI context construction
- Advanced planning

Potential infrastructure:
```text
PostgreSQL → authoritative memory/events
Qdrant     → semantic retrieval
```

### Deliverable
NPC decisions can be influenced by relevant events from years or generations earlier.

---

## Phase 9 — Advanced World

### Objective
Expand from village simulation toward civilization simulation.

Potential systems:
- Seasons
- Advanced weather
- Natural disasters
- Complex ecology
- Culture
- Religion
- Language
- Politics
- Institutions
- Technology
- Multiple settlements
- Migration
- Diplomacy
- Warfare
- Advanced economy

These are long-term systems, not requirements for the first village.

---

# 19. Development Strategy

Build through vertical slices rather than isolated systems.

Example:

```text
Plant
 ↓
Growth
 ↓
NPC perceives plant
 ↓
NPC knows/how learns to harvest
 ↓
Harvest action
 ↓
Food enters inventory
 ↓
NPC consumes food
 ↓
Health changes
```

Each slice should create a complete working loop before expanding.

---

# 20. Performance Strategy

Initial target is a deep simulation rather than a huge population.

| Stage | Population |
|---|---:|
| Initial settlers | 8–10 |
| Survival | 10–20 |
| Settlement | 20–50 |
| Village | 50–100 |
| Mature village | 100–250 |
| Beyond 250 | Profile first |

Use:
- Event-driven behavior where possible
- Deterministic systems
- Simulation level-of-detail
- Background simulation for inactive entities
- AI request prioritization
- AI request budgets

The simulation must continue if the AI provider is unavailable.

---

# 21. Save System

The final product requires save slots.

A save preserves the authoritative world state:
- Terrain
- Resources
- Entities
- NPCs
- Animals
- Buildings
- Knowledge
- Relationships
- Memories
- Events
- Simulation time

Save snapshots are also useful for experiments:

```text
Save
 ↓
Change the world
 ↓
Observe consequences
 ↓
Reload
```

---

# 22. Testing Philosophy

The simulation must be testable without relying only on visual inspection.

Support:
- Fixed world seeds
- Deterministic runs where possible
- Automated long-duration simulations
- Population statistics
- Resource statistics
- Birth/death statistics
- Failure analysis
- Performance benchmarks
- Regression tests

Example:
```text
Seed: 12345
Population: 10
Simulation: 100 years
```

Measure:
- Population
- Food production
- Food consumption
- Births
- Deaths
- Resource depletion
- Resource regeneration
- Buildings
- Knowledge

AI introduces nondeterminism, but the underlying deterministic simulation should remain reproducible.

---

# 23. First Major Milestone — The Village

The first major release is intentionally smaller than the long-term vision.

Start with:

```text
10 settlers
     ↓
Undeveloped world
     ↓
Basic survival
     ↓
Food
     ↓
Shelter
     ↓
Farming
     ↓
Families
     ↓
Children
     ↓
Jobs
     ↓
Construction
     ↓
Population growth
     ↓
Resource management
     ↓
50+ people
     ↓
Functioning village
```

The defining test is:

> **Can we start with a small group of settlers, leave the simulation alone, and return later to find a believable village that developed without direct control?**

If yes, the core concept works.

---

# 24. Final Design Principle

> **Do not build the simulation around what we currently want the village to do. Build general systems that allow the village to decide what it should do.**

Avoid scripted progression:

```text
Day 10 → Farm
Day 20 → Blacksmith
Day 30 → Market
Day 40 → School
```

Prefer:

```text
Needs
+
Environment
+
Resources
+
Knowledge
+
Skills
+
Goals
+
Relationships
+
Actions
        ↓
Emergent behavior
        ↓
Village
```

The objective is not to create a convincing animation of a village.

The objective is to create a **world in which a village can genuinely emerge**.
