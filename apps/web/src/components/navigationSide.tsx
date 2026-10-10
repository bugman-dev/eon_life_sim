import {
  AnimalsIcon,
  BuildingsIcon,
  EventsIcon,
  PeopleIcon,
  PowersIcon,
  ResearchIcon,
  ResourcesIcon,
  SettingsIcon,
  WorldIcon,
} from "../assets/icons";

const icons = {
  world: WorldIcon,
  people: PeopleIcon,
  buildings: BuildingsIcon,
  resources: ResourcesIcon,
  animals: AnimalsIcon,
  events: EventsIcon,
  research: ResearchIcon,
  powers: PowersIcon,
  settings: SettingsIcon,
} as const;

const navItems = [
  { label: "World", icon: "world", active: true },
  { label: "People", icon: "people" },
  { label: "Buildings", icon: "buildings" },
  { label: "Resources", icon: "resources" },
  { label: "Animals", icon: "animals" },
  { label: "Events", icon: "events" },
  { label: "Research", icon: "research" },
  { label: "God Powers", icon: "powers" },
  { label: "Settings", icon: "settings" },
] as const;

export default function NavigationSide() {
  return (
    <nav className="eon-nav" aria-label="Primary">
      {navItems.map((item) => {
        const Glyph = icons[item.icon];
        return (
          <button
            type="button"
            key={item.label}
            className={"active" in item && item.active ? "is-active" : undefined}
          >
            <Glyph />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
