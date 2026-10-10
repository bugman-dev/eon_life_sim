import type { ReactNode } from "react";
import type { WorldSessionState } from "@life-simulator/shared";
import {
  AnimalsIcon,
  FoodIcon,
  PeopleIcon,
  SmileIcon,
  StoneIcon,
  WoodIcon,
} from "../assets/icons";
import ActiveTasks from "../components/activeTasks";
import EonTimeline from "../components/eonTimeline";
import FloatingStats from "../components/floatingStats";
import NavigationSide from "../components/navigationSide";
import NavigationTop from "../components/navigationTop";
import RecentEvents from "../components/recentEvents";
import SelectedItemData from "../components/selectedItemData";
import WorldStatus from "../components/worldStatus";
import "./Layout.css";

const stats = [
  {
    label: "Population",
    value: "12",
    delta: "+2",
    note: "5 adults 7 children",
    icon: <PeopleIcon />,
    tone: "blue",
  },
  {
    label: "Food",
    value: "532",
    delta: "+12",
    note: "in storage",
    icon: <FoodIcon />,
    tone: "amber",
  },
  {
    label: "Wood",
    value: "318",
    delta: "+8",
    note: "in storage",
    icon: <WoodIcon />,
    tone: "brown",
  },
  {
    label: "Stone",
    value: "126",
    delta: "+4",
    note: "in storage",
    icon: <StoneIcon />,
    tone: "slate",
  },
  {
    label: "Animals",
    value: "27",
    delta: "+3",
    note: "18 herbivores 9 carnivores",
    icon: <AnimalsIcon />,
    tone: "indigo",
  },
  {
    label: "Happiness",
    value: "72%",
    delta: "+5%",
    note: "Stable",
    icon: <SmileIcon />,
    tone: "green",
  },
];

export default function Layout({
  children,
  session,
  onToggleSimulation,
}: {
  children: ReactNode;
  session?: WorldSessionState | null;
  onToggleSimulation?: () => void;
}) {
  return (
    <div className="eon">
      <NavigationTop />
      <div className="eon-body">
        <NavigationSide />
        <div className="eon-center">
          <div className="eon-map">
            <div className="eon-map-stage">{children}</div>
            <div className="eon-stats">
              {stats.map((stat) => (
                <FloatingStats key={stat.label} {...stat} />
              ))}
            </div>
            {/* 
            <div className="eon-tools">
              <button type="button" className="is-active" aria-label="Select">
                <CursorIcon />
              </button>
              <button type="button" aria-label="Pan">
                <HandIcon />
              </button>
              <button type="button" aria-label="Area">
                <MarqueeIcon />
              </button>
              <button type="button" aria-label="Pin">
                <PinIcon />
              </button>
            </div> */}

            {/* <div className="eon-zoom">
              <button type="button" aria-label="Zoom in">
                +
              </button>
              <button type="button" aria-label="Zoom out">
                âˆ’
              </button>
              <button type="button" aria-label="Layers">
                <LayersIcon />
              </button>
            </div> */}

            {/* <div className="eon-minimap" aria-hidden="true">
              <span />
            </div> */}

            {/* <div className="eon-coords">
              <span>X: 248, Y: 172</span>
              <strong>
                <Icon name="world" /> Grassland
              </strong>
            </div> */}
          </div>

          <div className="eon-lower">
            <EonTimeline
              tick={session?.simulationTick ?? "0"}
              seconds={session?.gameSecond ?? 0}
              minutes={session?.gameMinute ?? 0}
              hours={session?.gameHour ?? 0}
              days={session?.gameDay ?? 1}
              running={session?.status === "running"}
              onToggle={onToggleSimulation}
            />
            <ActiveTasks />
            <WorldStatus />
          </div>
        </div>
        <aside className="eon-side">
          <SelectedItemData />
          <RecentEvents />
        </aside>
      </div>
    </div>
  );
}
