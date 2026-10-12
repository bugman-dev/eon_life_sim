import type { AnimalSpecies } from "@life-simulator/shared";
import type { Graphics } from "pixi.js";
import { paintRabbit } from "./Rabbits";

/** One picture per species. The drawing itself stays in that species file. */
export const animalAppearance: Record<AnimalSpecies, (graphics: Graphics) => void> = {
  rabbit: paintRabbit,
};
