import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DepositType, VegetationType, WorldTile } from "@life-simulator/shared";

/** The plant named in the selection. A tree on the tile is reported as trees. */
export type SelectedVegetation = "trees" | "shrubs" | "flowers" | "grass";

/**
 * The one selected map item.
 * A ground click stores the tile and leaves deposit and vegetation empty.
 * A pile click stores that deposit. A plant click stores that plant.
 * A new click replaces the previous item.
 */
export type Selection = {
  tile: WorldTile;
  deposit: DepositType | null;
  vegetation: SelectedVegetation | null;
};

export function selectedVegetation(type: VegetationType): SelectedVegetation {
  if (type === "tree") {
    return "trees";
  }
  return type;
}

/**
 * Shared page state.
 * selection holds one item. A new selection replaces the previous one.
 */
export type AppState = {
  selection: Selection | null;
};

type AppStateContextValue = {
  state: AppState;
  select: (selection: Selection) => void;
  clearSelection: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const select = useCallback((next: Selection) => {
    setSelection(next);
  }, []);
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);
  const value = useMemo<AppStateContextValue>(
    () => ({
      state: { selection },
      select,
      clearSelection,
    }),
    [selection, select, clearSelection],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider.");
  }
  return value;
}
