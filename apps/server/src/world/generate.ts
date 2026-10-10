import {
  DEFAULT_WORLD_SIZE,
  MAX_WORLD_SIZE,
  MIN_WORLD_SIZE,
  WORLD_GENERATION_VERSION,
  WORLD_TILE_SIZE,
  type TerrainType,
  type WaterType,
  type WorldTile,
} from "@life-simulator/shared";
import { createStream } from "./prng.js";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export type GeneratedWorld = {
  seed: bigint;
  generationVersion: typeof WORLD_GENERATION_VERSION;
  width: number;
  height: number;
  tileSize: typeof WORLD_TILE_SIZE;
  tiles: WorldTile[];
};

type Sample = {
  x: number;
  y: number;
  height: number;
  coast: number;
  terrain: TerrainType;
  waterType: WaterType;
};

export function generateWorld(input: { seed: bigint; width?: number; height?: number }): GeneratedWorld {
  const width = input.width ?? DEFAULT_WORLD_SIZE;
  const height = input.height ?? DEFAULT_WORLD_SIZE;
  assertDimensions(width, height);

  const samples = buildIsland(input.seed, width, height);
  labelWater(samples, width, height);
  assignElevation(samples, input.seed, width, height);
  carveDownhillRivers(samples, input.seed, width, height);
  removeIsolatedWater(samples, width, height);
  fillEnclosedLand(samples, width, height);
  assignCoastSand(samples, input.seed, width, height);
  assignDryLand(samples, input.seed, width, height);

  const world: GeneratedWorld = {
    seed: input.seed,
    generationVersion: WORLD_GENERATION_VERSION,
    width,
    height,
    tileSize: WORLD_TILE_SIZE,
    tiles: samples.map((sample) => toTile(sample)),
  };
  assertWorld(world);
  return world;
}

function assertDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || width < MIN_WORLD_SIZE || width > MAX_WORLD_SIZE) {
    throw new GenerationError(`Width must be an integer from ${MIN_WORLD_SIZE} to ${MAX_WORLD_SIZE}.`);
  }
  if (!Number.isInteger(height) || height < MIN_WORLD_SIZE || height > MAX_WORLD_SIZE) {
    throw new GenerationError(`Height must be an integer from ${MIN_WORLD_SIZE} to ${MAX_WORLD_SIZE}.`);
  }
}

function buildIsland(seed: bigint, width: number, height: number) {
  const span = Math.min(width, height);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const coast = makeNoise(seed, "coast", Math.max(8, Math.round(span / 5)), Math.max(4, Math.round(span / 14)));
  const samples: Sample[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const warpedX = x + (coast(x + span, y) - 0.5) * span * 0.28;
      const warpedY = y + (coast(x, y + span) - 0.5) * span * 0.28;
      const dx = (warpedX - centerX) / (span * 0.5);
      const dy = (warpedY - centerY) / (span * 0.5);
      const dist = Math.hypot(dx, dy);
      const radius = 1.05 + (coast(warpedX, warpedY) - 0.5) * 0.48;
      const water = edge || dist >= radius;
      samples.push({
        x,
        y,
        height: 0,
        coast: 0,
        terrain: water ? "water" : "grass",
        waterType: water ? "lake" : "none",
      });
    }
  }

  addIslet(samples, seed, width, height, centerX, centerY, span, coast);
  carveLakes(samples, seed, width, height, centerX, centerY, span);
  return samples;
}

function addIslet(
  samples: Sample[],
  seed: bigint,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  span: number,
  coast: (x: number, y: number) => number,
) {
  const stream = createStream(seed, "islet");
  const base = stream() * Math.PI * 2;
  const radius = Math.max(3, span * 0.04);
  let center: { x: number; y: number } | undefined;
  for (let turn = 0; turn < 8; turn += 1) {
    const angle = base + turn * (Math.PI / 4);
    const reach = span * 0.56;
    const x = centerX + Math.cos(angle) * reach;
    const y = centerY + Math.sin(angle) * reach;
    const warpedX = x + (coast(x + span, y) - 0.5) * span * 0.28;
    const warpedY = y + (coast(x, y + span) - 0.5) * span * 0.28;
    const dist = Math.hypot((warpedX - centerX) / (span * 0.5), (warpedY - centerY) / (span * 0.5));
    const shore = 1.05 + (coast(warpedX, warpedY) - 0.5) * 0.48;
    const inset = x > radius + 1 && y > radius + 1 && x < width - radius - 2 && y < height - radius - 2;
    if (inset && dist > shore + 0.1) {
      center = { x, y };
      break;
    }
  }
  if (!center) {
    return;
  }
  for (const sample of samples) {
    if (Math.hypot(sample.x - center.x, sample.y - center.y) < radius) {
      sample.terrain = "grass";
      sample.waterType = "none";
    }
  }
}

function carveLakes(samples: Sample[], seed: bigint, width: number, height: number, centerX: number, centerY: number, span: number) {
  const inland = distanceFrom(samples, width, height, (sample) => sample.terrain === "water");
  const wobble = makeNoise(seed, "lake-edge", Math.max(6, Math.round(span / 10)), 4);
  const jitter = createStream(seed, "lake-jitter");
  const blobs = [
    { x: 0.02, y: -0.22, scale: 0.16 },
    { x: -0.2, y: 0.16, scale: 0.055 },
  ];
  for (const blob of blobs) {
    const lakeX = centerX + (blob.x + (jitter() - 0.5) * 0.1) * span;
    const lakeY = centerY + (blob.y + (jitter() - 0.5) * 0.1) * span;
    const lakeRadius = span * blob.scale;
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      if (!sample || sample.terrain === "water" || (inland[index] ?? 0) < lakeRadius) {
        continue;
      }
      const warpedX = sample.x + (wobble(sample.x, sample.y) - 0.5) * lakeRadius * 0.8;
      const warpedY = sample.y + (wobble(sample.y + 20, sample.x) - 0.5) * lakeRadius * 0.8;
      const dist = Math.hypot(warpedX - lakeX, warpedY - lakeY);
      const limit = lakeRadius * (0.62 + wobble(sample.x, sample.y) * 0.7);
      if (dist < limit) {
        sample.terrain = "water";
        sample.waterType = "lake";
      }
    }
  }
}

function labelWater(samples: Sample[], width: number, height: number) {
  const seen = new Uint8Array(samples.length);
  const queue: number[] = [];
  for (const sample of samples) {
    if (sample.terrain !== "water") {
      sample.waterType = "none";
      continue;
    }
    const edge = sample.x === 0 || sample.y === 0 || sample.x === width - 1 || sample.y === height - 1;
    sample.waterType = edge ? "coast" : "lake";
    if (edge) {
      const index = sample.y * width + sample.x;
      seen[index] = 1;
      queue.push(index);
    }
  }

  while (queue.length > 0) {
    const index = queue.pop();
    if (index === undefined) {
      break;
    }
    const sample = samples[index];
    if (!sample) {
      continue;
    }
    for (const point of neighbors(sample.x, sample.y, width, height)) {
      const next = point.y * width + point.x;
      const other = samples[next];
      if (!other || other.terrain !== "water" || other.waterType === "coast" || seen[next]) {
        continue;
      }
      other.waterType = "coast";
      seen[next] = 1;
      queue.push(next);
    }
  }
}

function assignElevation(samples: Sample[], seed: bigint, width: number, height: number) {
  const distance = new Float64Array(samples.length).fill(Number.POSITIVE_INFINITY);
  const queue: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index]?.waterType === "coast") {
      distance[index] = 0;
      queue.push(index);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const sample = samples[index];
    if (!sample) {
      continue;
    }
    for (const point of neighbors(sample.x, sample.y, width, height)) {
      const next = point.y * width + point.x;
      const other = samples[next];
      if (!other) {
        continue;
      }
      const step = other.terrain === "water" ? 0 : 1;
      const nextDistance = (distance[index] ?? 0) + step;
      if (nextDistance < (distance[next] ?? Number.POSITIVE_INFINITY)) {
        distance[next] = nextDistance;
        queue.push(next);
      }
    }
  }

  const rough = makeNoise(seed, "relief", 6, 3);
  const land = samples
    .map((sample, index) => ({ sample, index }))
    .filter((entry) => entry.sample.terrain !== "water" && Number.isFinite(distance[entry.index] ?? Number.POSITIVE_INFINITY));
  land.sort((left, right) => (distance[left.index] ?? 0) - (distance[right.index] ?? 0) || left.sample.y - right.sample.y || left.sample.x - right.sample.x);
  for (const entry of land) {
    const here = distance[entry.index] ?? 0;
    entry.sample.coast = here;
    entry.sample.height = here + (rough(entry.sample.x, entry.sample.y) - 0.5) * 8;
  }
}

function carveDownhillRivers(samples: Sample[], seed: bigint, width: number, height: number) {
  const wander = makeNoise(seed, "wander", Math.max(5, Math.round(Math.min(width, height) / 16)), 4);
  const span = Math.min(width, height);
  const land = samples.filter((sample) => sample.terrain !== "water");
  const ranked = [...land].sort((left, right) => right.height - left.height || left.y - right.y || left.x - right.x);
  const count = Math.min(
    Math.max(span < 32 ? 1 : 3, Math.round(span / 20)),
    Math.max(1, Math.floor(land.length / 12)),
  );
  const spacing = span * 0.16;
  const peak = ranked[0]?.height ?? 0;
  const starts: Sample[] = [];
  for (const candidate of ranked) {
    if (starts.length >= count || candidate.height < peak * 0.62) {
      break;
    }
    if (starts.every((start) => Math.hypot(start.x - candidate.x, start.y - candidate.y) >= spacing)) {
      starts.push(candidate);
    }
  }

  for (const start of starts) {
    const seen = new Set<string>();
    const path: Sample[] = [];
    let current = start;
    let sinceDrop = 0;
    for (let step = 0; step < width + height; step += 1) {
      if (current.terrain === "water") {
        break;
      }
      seen.add(`${current.x},${current.y}`);
      const options = neighbors8(current.x, current.y, width, height)
        .map((point) => samples[point.y * width + point.x])
        .filter((sample): sample is Sample => sample !== undefined && !seen.has(`${sample.x},${sample.y}`));
      if (options.some((sample) => sample.terrain === "water")) {
        current.terrain = "water";
        current.waterType = "river";
        path.push(current);
        break;
      }
      const landOptions = options.filter((sample) => sample.terrain !== "water");
      const dropping = landOptions.filter((sample) => sample.coast < current.coast);
      const pool = sinceDrop < 8 ? landOptions.filter((sample) => sample.coast <= current.coast) : dropping;
      const angle = wander(current.x, current.y) * Math.PI * 2;
      const preferX = Math.cos(angle);
      const preferY = Math.sin(angle);
      const next = (pool.length > 0 ? pool : dropping)
        .map((sample) => {
          const stepX = sample.x - current.x;
          const stepY = sample.y - current.y;
          const align = (stepX * preferX + stepY * preferY) / Math.hypot(stepX, stepY);
          return { sample, score: -align };
        })
        .sort((left, right) => left.score - right.score || left.sample.y - right.sample.y || left.sample.x - right.sample.x)[0];
      current.terrain = "water";
      current.waterType = "river";
      path.push(current);
      if (!next) {
        break;
      }
      sinceDrop = next.sample.coast < current.coast ? 0 : sinceDrop + 1;
      current = next.sample;
    }
    widenRiver(samples, path, width, height);
  }
}

function widenRiver(samples: Sample[], path: Sample[], width: number, height: number) {
  const span = Math.min(width, height);
  if (span < 24 || path.length === 0) {
    return;
  }
  for (let index = 0; index < path.length; index += 1) {
    const sample = path[index];
    if (!sample) {
      continue;
    }
    const progress = index / Math.max(1, path.length - 1);
    const radius = progress > 0.7 ? 2 : 1;
    const before = path[Math.max(0, index - 1)] ?? sample;
    const after = path[Math.min(path.length - 1, index + 1)] ?? sample;
    let sideX = -(after.y - before.y);
    let sideY = after.x - before.x;
    const scale = Math.max(Math.abs(sideX), Math.abs(sideY));
    if (scale === 0) {
      sideX = 0;
      sideY = 1;
    } else {
      sideX = Math.round(sideX / scale);
      sideY = Math.round(sideY / scale);
    }
    for (const side of [-1, 1]) {
      for (let step = 1; step <= radius; step += 1) {
        const x = sample.x + sideX * side * step;
        const y = sample.y + sideY * side * step;
        if (x < 0 || y < 0 || x >= width || y >= height) {
          continue;
        }
        const other = samples[y * width + x];
        if (!other || other.terrain === "water") {
          continue;
        }
        other.terrain = "water";
        other.waterType = "river";
      }
    }
  }
}

function removeIsolatedWater(samples: Sample[], width: number, height: number) {
  const clear: Sample[] = [];
  for (const sample of samples) {
    if (sample.terrain !== "water" || sample.waterType === "river") {
      continue;
    }
    const touchingWater = neighbors(sample.x, sample.y, width, height).some((point) => {
      return samples[point.y * width + point.x]?.terrain === "water";
    });
    if (!touchingWater) {
      clear.push(sample);
    }
  }
  for (const sample of clear) {
    sample.terrain = "grass";
    sample.waterType = "none";
    sample.height = 0.05;
  }
}

function fillEnclosedLand(samples: Sample[], width: number, height: number) {
  const fill: Sample[] = [];
  for (const sample of samples) {
    if (sample.terrain === "water") {
      continue;
    }
    const around = neighbors(sample.x, sample.y, width, height);
    if (around.length > 0 && around.every((point) => samples[point.y * width + point.x]?.terrain === "water")) {
      fill.push(sample);
    }
  }
  for (const sample of fill) {
    const besideCoast = neighbors(sample.x, sample.y, width, height).some((point) => {
      return samples[point.y * width + point.x]?.waterType === "coast";
    });
    sample.terrain = "water";
    sample.waterType = besideCoast ? "coast" : "lake";
    sample.height = 0;
  }
}

function assignCoastSand(samples: Sample[], seed: bigint, width: number, height: number) {
  const shore = makeNoise(seed, "shore", 5, 3);
  const distance = distanceFrom(samples, width, height, (sample) => sample.waterType === "coast");
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const steps = distance[index] ?? -1;
    if (!sample || sample.terrain !== "grass" || steps <= 0) {
      continue;
    }
    const widthLimit = 2 + Math.round(shore(sample.x, sample.y) * 6);
    if (steps <= widthLimit) {
      sample.terrain = "sand";
    }
  }
}

function assignDryLand(samples: Sample[], seed: bigint, width: number, height: number) {
  const span = Math.min(width, height);
  const dry = makeNoise(seed, "dry", Math.max(10, Math.round(span / 8)), 5);
  const distance = distanceFrom(samples, width, height, (sample) => sample.waterType === "river" || sample.waterType === "lake");
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const steps = distance[index] ?? -1;
    if (!sample || sample.terrain !== "grass" || steps <= 8) {
      continue;
    }
    if (dry(sample.x, sample.y) > 0.74) {
      sample.terrain = "dirt";
    }
  }
}

function distanceFrom(samples: Sample[], width: number, height: number, source: (sample: Sample) => boolean) {
  const distance = new Int16Array(samples.length).fill(-1);
  const queue: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample && source(sample)) {
      distance[index] = 0;
      queue.push(index);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const sample = samples[index];
    if (!sample) {
      continue;
    }
    for (const point of neighbors(sample.x, sample.y, width, height)) {
      const next = point.y * width + point.x;
      if (distance[next] !== -1) {
        continue;
      }
      const other = samples[next];
      if (!other || other.terrain === "water") {
        continue;
      }
      distance[next] = (distance[index] ?? 0) + 1;
      queue.push(next);
    }
  }
  return distance;
}

function toTile(sample: Sample): WorldTile {
  const water = sample.terrain === "water";
  return {
    x: sample.x,
    y: sample.y,
    terrainType: sample.terrain,
    elevation: 0,
    waterType: water ? sample.waterType : "none",
    soilType: water ? "poor" : "normal",
    fertility: 0,
    vegetationType: "none",
    vegetationDensity: 0,
    deposits: [],
  };
}

export function assertWorld(world: GeneratedWorld) {
  if (world.generationVersion !== WORLD_GENERATION_VERSION) {
    throw new GenerationError("Generation version is not supported.");
  }
  if (world.tiles.length !== world.width * world.height) {
    throw new GenerationError("Tile count must equal width × height.");
  }

  const seen = new Set<string>();
  let water = 0;
  let land = 0;
  for (const tile of world.tiles) {
    const key = `${tile.x},${tile.y}`;
    if (tile.x < 0 || tile.y < 0 || tile.x >= world.width || tile.y >= world.height || seen.has(key)) {
      throw new GenerationError("Tile coordinates must be unique and inside the map.");
    }
    seen.add(key);
    if (tile.elevation !== 0 || tile.fertility !== 0 || tile.vegetationDensity !== 0) {
      throw new GenerationError("Elevation, fertility, and vegetation are not generated yet.");
    }
    if (tile.vegetationType !== "none" || tile.deposits.length > 0) {
      throw new GenerationError("Resources are not generated yet.");
    }
    if ((tile.terrainType === "water") !== (tile.waterType !== "none")) {
      throw new GenerationError("Water and land attributes disagree.");
    }
    if (tile.terrainType === "water") {
      water += 1;
    } else {
      land += 1;
    }
  }

  if (water === 0 || land === 0) {
    throw new GenerationError("The map must contain both land and water.");
  }
}

function makeNoise(seed: bigint, stage: string, coarse: number, fine: number) {
  const low = latticeNoise(seed, stage, coarse);
  const high = latticeNoise(seed, `${stage}-detail`, fine);
  return (x: number, y: number) => clamp01(low(x, y) * 0.75 + high(x, y) * 0.25);
}

function latticeNoise(seed: bigint, stage: string, cell: number) {
  const cache = new Map<string, number>();
  const at = (ix: number, iy: number) => {
    const key = `${ix},${iy}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = createStream(seed, `${stage}:${ix}:${iy}`)();
    cache.set(key, value);
    return value;
  };

  return (x: number, y: number) => {
    const x0 = Math.floor(x / cell);
    const y0 = Math.floor(y / cell);
    const tx = smooth(x / cell - x0);
    const ty = smooth(y / cell - y0);
    const a = lerp(at(x0, y0), at(x0 + 1, y0), tx);
    const b = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return lerp(a, b, ty);
  };
}

function neighbors8(x: number, y: number, width: number, height: number) {
  const points: { x: number; y: number }[] = [];
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }
      points.push({ x: nextX, y: nextY });
    }
  }
  return points;
}

function neighbors(x: number, y: number, width: number, height: number) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height);
}

function smooth(value: number) {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
