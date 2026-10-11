export { MAX_CLIENT_MESSAGE_BYTES, PROTOCOL_VERSION } from "./protocol/messages.js";
export { clientMessageSchema, type ClientMessage } from "./schemas/client-message.js";
export {
  DEFAULT_WORLD_SIZE,
  MAX_WORLD_SIZE,
  MIN_WORLD_SIZE,
  WORLD_GENERATION_VERSION,
  WORLD_TILE_SIZE,
  DEPOSIT_GROWTH_STAGE,
  depositTypeSchema,
  resourceDepositSchema,
  soilTypeSchema,
  terrainTypeSchema,
  waterTypeSchema,
  worldMapSchema,
  worldTileSchema,
  type DepositType,
  type ResourceDeposit,
  type SoilType,
  type TerrainType,
  type WaterType,
  type WorldMap,
  type WorldTile,
} from "./schemas/world-map.js";
export {
  serverMessageSchema,
  simulationStateSchema,
  worldSessionStateSchema,
  worldSessionStatusSchema,
  type ServerMessage,
  type SimulationState,
  type WorldSessionState,
  type WorldSessionStatus,
} from "./schemas/world-session.js";
