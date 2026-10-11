/**
 * Mixes a seed with integer coordinates.
 * Hashing the decimal text of x and y lines neighboring tiles up, which draws stripes on the map.
 */
export function hashTile(seed: string | bigint, label: string, x: number, y: number): number {
  let hash = 2166136261;
  const text = `${typeof seed === "bigint" ? seed.toString() : seed}:${label}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash = Math.imul(hash ^ x, 0x85ebca6b);
  hash = Math.imul(hash ^ y, 0xc2b2ae35);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}
