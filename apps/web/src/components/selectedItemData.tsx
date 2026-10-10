import { PinIcon, TreeArt, TreeIcon } from "../assets/icons";

export default function SelectedItemData() {
  return (
    <section className="eon-card eon-selected">
      <header>
        <h2>Selected</h2>
        <button type="button" aria-label="Close">
          Ã—
        </button>
      </header>
      <div className="eon-selected-title">
        <span className="eon-tree-badge" aria-hidden="true">
          <TreeIcon />
        </span>
        <div>
          <strong>Tree</strong>
          <small>Oak (Wild)</small>
        </div>
        <em>Healthy</em>
      </div>
      <div className="eon-tabs">
        <button type="button" className="is-active">
          Overview
        </button>
        <button type="button">Resources</button>
        <button type="button">Notes</button>
      </div>
      <div className="eon-tree-art" aria-hidden="true">
        <TreeArt />
      </div>
      <dl className="eon-facts">
        <div>
          <dt>Growth Stage</dt>
          <dd>Mature</dd>
        </div>
        <div>
          <dt>Health</dt>
          <dd>
            100%
            <span className="eon-health">
              <i />
            </span>
          </dd>
        </div>
        <div>
          <dt>Biomass</dt>
          <dd>120</dd>
        </div>
        <div>
          <dt>Harvestable</dt>
          <dd>80</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>(248, 172)</dd>
        </div>
        <div>
          <dt>Terrain</dt>
          <dd>Grassland</dd>
        </div>
      </dl>
      <button type="button" className="eon-primary">
        <PinIcon /> View in World
      </button>
    </section>
  );
}
