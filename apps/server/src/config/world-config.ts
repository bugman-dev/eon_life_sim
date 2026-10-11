import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { DepositSettings } from "../world/deposits.js";

const depositBandSchema = z
  .object({
    percent: z.number().min(0).max(100),
    minAmount: z.number().int(),
    maxAmount: z.number().int(),
  })
  .strict()
  .refine((band) => band.minAmount <= band.maxAmount, {
    message: "minAmount must be less than or equal to maxAmount",
  });

const worldConfigSchema = z
  .object({
    deposits: z
      .object({
        stone: depositBandSchema,
        ore: depositBandSchema,
        clay: depositBandSchema,
      })
      .strict(),
  })
  .strict();

/**
 * Reads deposit percents and amount ranges from worldConfig.json.
 * Looks in the process directory, then two levels up, the same places as `.env`.
 */
export function loadWorldConfig(cwd = process.cwd()): DepositSettings {
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
