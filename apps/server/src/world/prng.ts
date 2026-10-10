/**
 * Mulberry32, seeded from a hash of the stored world seed and a stage name.
 * Each stage gets its own stream so editing one stage does not reshuffle the others.
 * The sequence depends only on those inputs.
 */

export function mixSeed(seed: bigint, stage: string): number {
  let hash = 2166136261;
  const text = `${seed.toString()}:${stage}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createStream(seed: bigint, stage: string): () => number {
  let state = mixSeed(seed, stage);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
