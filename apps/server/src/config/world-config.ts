import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { DepositPercents } from "../world/deposits.js";

const percent = z.number().min(0).max(100);

const worldConfigSchema = z
  .object({
    deposits: z
      .object({
        stone: percent,
        ore: percent,
        clay: percent,
      })
      .strict(),
  })
  .strict();

/**
 * Reads deposit percents from worldConfig.json.
 * Looks in the process directory, then two levels up, the same places as `.env`.
 */
export function loadWorldConfig(cwd = process.cwd()): DepositPercents {
  const candidates = [resolve(cwd, "worldConfig.json"), resolve(cwd, "../../worldConfig.json")];
  let raw: string | undefined;
  let found = candidates[0] ?? "worldConfig.json";
  for (const path of candidates) {
    try {
      raw = readFileSync(path, "utf8");
      found = path;
      break;
    } catch (error) {
      if (!isMissingFile(error)) {
        throw new Error(`Invalid configuration: ${path} could not be read.`);
      }
    }
  }
  if (raw === undefined) {
    throw new Error("Invalid configuration: worldConfig.json was not found.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid configuration: ${found} is not valid JSON.`);
  }

  const parsed = worldConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "worldConfig"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  return parsed.data.deposits;
}

function isMissingFile(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
