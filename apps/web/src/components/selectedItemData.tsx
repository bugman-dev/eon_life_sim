import { useEffect } from "react";
import type { WorldTile } from "@life-simulator/shared";
import { useAppState } from "../state/app-state";

const GROWTH_STAGE_LABEL = { 1: "New", 2: "Growing", 3: "Mature" } as const;

export default function SelectedItemData() {
  const { state } = useAppState();
  const tile = state.selection?.tile ?? null;

  useEffect(() => {
    if (tile) {
      console.log(tile);
    }
  }, [tile]);

  return (
    <section className="eon-card eon-selected">
      <header>
        <h2>Selected</h2>
        <button type="button" aria-label="Close">
          Ã—
        </button>
      </header>
      {tile ? <TileFacts tile={tile} /> : <p>Click a tile to see its data.</p>}
    </section>
  );
}

function TileFacts({ tile }: { tile: WorldTile }) {
  const deposit = tile.deposits[0];
  const plant = tile.vegitation[0];

  return (
    <dl className="eon-facts">
      <div>
        <dt>Position</dt>
        <dd>
          ({tile.x}, {tile.y})
        </dd>
      </div>
      <div>
        <dt>Terrain</dt>
        <dd>{label(tile.terrainType)}</dd>
      </div>
      <div>
        <dt>Water</dt>
        <dd>{label(tile.waterType)}</dd>
      </div>
      <div>
        <dt>Soil</dt>
        <dd>{label(tile.soilType)}</dd>
      </div>
      <div>
        <dt>Fertility</dt>
        <dd>{tile.fertility}</dd>
      </div>
      <div>
        <dt>Elevation</dt>
        <dd>{tile.elevation}</dd>
      </div>
      <div>
        <dt>Deposit</dt>
        <dd>{deposit ? `${label(deposit.type)} · ${deposit.amount} · ${GROWTH_STAGE_LABEL[deposit.growthStage]}` : "None"}</dd>
      </div>
      <div>
        <dt>Vegetation</dt>
        <dd>{plant ? `${label(plant.type)} · ${plant.amount} · ${GROWTH_STAGE_LABEL[plant.growthStage]}` : "None"}</dd>
      </div>
    </dl>
  );
}

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
