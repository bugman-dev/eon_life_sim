import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { WorldTile } from "@life-simulator/shared";

/**
 * PNG data URLs of the sprites drawn for the selected tile.
 * terrain is the diamond. deposit and vegetation are set when that sprite was drawn.
 */
export type SelectionPictures = {
  terrain: string | null;
  deposit: string | null;
  vegetation: string | null;
};

/**
 * The deposit or plant on the selected tile.
 * A tile can carry one of each, and this keeps whichever of them is present.
 */
export type SelectionResource =
  | { deposit: WorldTile["deposits"][number]; vegitation?: WorldTile["vegitation"][number] }
  | { vegitation: WorldTile["vegitation"][number]; deposit?: WorldTile["deposits"][number] };

/**
 * The one selected map item.
 * A click stores the tile under the pointer and the pictures drawn on it.
 * A new click replaces the previous tile.
 */
export type Selection = {
  tile: WorldTile;
  pictures: SelectionPictures;
  resource: SelectionResource | null;
};

/**
 * Shared page state.
 * selection holds one item. A new selection replaces the previous one.
 */
export type AppState = {
  selection: Selection | null;
};

type ViewInWorld = (x: number, y: number) => void;

type AppStateContextValue = {
  state: AppState;
  select: (selection: Selection) => void;
  clearSelection: () => void;
  viewInWorld: ViewInWorld;
  registerViewInWorld: (handler: ViewInWorld | null) => void;
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
  const viewInWorldRef = useRef<ViewInWorld | null>(null);
  const registerViewInWorld = useCallback((handler: ViewInWorld | null) => {
    viewInWorldRef.current = handler;
  }, []);
  const viewInWorld = useCallback((x: number, y: number) => {
    viewInWorldRef.current?.(x, y);
  }, []);
  const value = useMemo<AppStateContextValue>(
    () => ({
      state: { selection },
      select,
      clearSelection,
      viewInWorld,
      registerViewInWorld,
    }),
    [selection, select, clearSelection, viewInWorld, registerViewInWorld],
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
