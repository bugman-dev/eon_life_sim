import { useEffect, useState } from "react";
import type { WorldTile } from "@life-simulator/shared";
import { PinIcon, TreeIcon } from "../assets/icons";
import {
  useAppState,
  type SelectionPictures,
  type SelectionResource,
} from "../state/app-state";
import { capitalizeText } from "../utils/helperFunctions";

const TABS = ["Overview", "Resources", "Notes"] as const;
type Tab = (typeof TABS)[number];

const GROWTH_STAGES = ["Young", "Young", "Mature"] as const;

export default function SelectedItemData() {
  const { state, viewInWorld } = useAppState();
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    if (state.selection) {
      const { pictures } = state.selection;
      console.log({
        tile: state.selection.tile,
        pictures: {
          terrain: Boolean(pictures.terrain),
          deposit: Boolean(pictures.deposit),
          vegetation: Boolean(pictures.vegetation),
        },
        resource: state.selection.resource,
      });
    }
  }, [state.selection]);

  return (
    <section className="eon-card eon-selected">
      <header>
        <h2>Selected</h2>
      </header>
      <div className="eon-selected-title">
        <span className="eon-tree-badge" aria-hidden="true">
          <TileIcon pictures={state.selection?.pictures} />
        </span>
        <div>
          <strong>
            {capitalizeText(
              state.selection?.tile.terrainType || "No terrain selected",
            )}
          </strong>
          <small>
            {capitalizeText(
              state.selection?.tile.soilType || "No soil selected",
            )}
          </small>
        </div>
      </div>
      <div className="eon-tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? "is-active" : undefined}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="eon-tab-panel" role="tabpanel">
        {tab === "Overview" ? (
          <Overview
            pictures={state.selection?.pictures}
            tile={state.selection?.tile}
          />
        ) : tab === "Resources" ? (
          <Resources
            pictures={state.selection?.pictures}
            tile={state.selection?.tile}
            resources={state.selection?.resource}
          />
        ) : (
          <Notes notes="" />
        )}
      </div>
      <button
        type="button"
        className="eon-primary"
        onClick={() => {
          const tile = state.selection?.tile;
          if (tile) {
            viewInWorld(tile.x, tile.y);
          }
        }}
      >
        <PinIcon /> View in World
      </button>
    </section>
  );
}

function TileIcon({ pictures }: { pictures: SelectionPictures | undefined }) {
  const src = pictures?.terrain;
  if (!src) {
    return <TreeIcon />;
  }
  return <img src={src} alt="" />;
}

function Overview({
  pictures,
  tile,
}: {
  pictures: SelectionPictures | undefined;
  tile: WorldTile | undefined;
}) {
  return (
    <>
      <div className="eon-tree-art" aria-hidden="true">
        {pictures?.terrain ? (
          <span className="eon-tile-picture">
            <img src={pictures.terrain} alt="terrain" />
          </span>
        ) : (
          <TreeIcon />
        )}
      </div>
      <dl className="eon-facts">
        <div>
          <dt>Fertility</dt>
          <dd>{tile?.fertility.toFixed(2) || "0.00"}</dd>
        </div>
        <div>
          <dt>Elevation</dt>
          <dd>{tile?.elevation.toFixed(2) || "0.00"}</dd>
        </div>
        <div>
          <dt>Water</dt>
          <dd>{capitalizeText(tile?.waterType || "None")}</dd>
        </div>

        <div>
          <dt>Position</dt>
          <dd>
            ({tile?.x || "0"}, {tile?.y || "0"})
          </dd>
        </div>
        <div>
          <dt>Terrain</dt>
          <dd>{capitalizeText(tile?.terrainType || "None")}</dd>
        </div>
      </dl>
    </>
  );
}

function Resources({
  pictures,
  tile,
  resources,
}: {
  pictures: SelectionPictures | undefined;
  tile: WorldTile | undefined;
  resources: SelectionResource | null | undefined;
}) {
  const deposit = resources?.deposit;
  const vegitation = resources?.vegitation;
  const resourceImage = deposit
    ? pictures?.deposit
    : vegitation
      ? pictures?.vegetation
      : null;
  return (
    <>
      <div className="eon-tree-art" aria-hidden="true">
        {resourceImage ? (
          <span className="eon-tile-picture">
            <img src={resourceImage} alt="resource" />
          </span>
        ) : (
          <TreeIcon />
        )}
      </div>
      {deposit ? (
        <div>
          <h3>Deposit</h3>

          <dl className="eon-facts">
            <div>
              <dt>Resource</dt>
              <dd>{capitalizeText(deposit.type || "None")}</dd>
            </div>
            <div>
              <dt>Harvestable</dt>
              <dd>{deposit.amount || 0}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>
                ({tile?.x || "0"}, {tile?.y || "0"})
              </dd>
            </div>
            <div>
              <dt>Terrain</dt>
              <dd>{capitalizeText(tile?.terrainType || "None")}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {vegitation ? (
        <div>
          <h3>Vegetation</h3>
          <dl className="eon-facts">
            <div>
              <dt>Resource</dt>
              <dd>{capitalizeText(vegitation.type || "None")}</dd>
            </div>
            <div>
              <dt>Growth</dt>
              <dd>{GROWTH_STAGES[vegitation.growthStage - 1] || "Unknown"}</dd>
            </div>
            <div>
              <dt>Harvestable</dt>
              <dd>{vegitation.amount || 0}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>
                ({tile?.x || "0"}, {tile?.y || "0"})
              </dd>
            </div>
            <div>
              <dt>Terrain</dt>
              <dd>{capitalizeText(tile?.terrainType || "None")}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {!deposit && !vegitation ? <p className="eon-notes">No Resource</p> : null}
    </>
  );
}

function Notes({ notes }: { notes: string | undefined }) {
  return <p className="eon-notes">{notes || "No notes"}</p>;
}
