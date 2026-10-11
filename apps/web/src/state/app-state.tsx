import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DepositType, WorldTile } from "@life-simulator/shared";

/**
 * The one selected map item.
 * A ground click stores the tile and leaves deposit empty.
 * A pile click stores that tile and the deposit that was hit.
 */
export type Selection = {
  tile: WorldTile;
  deposit: DepositType | null;
};

/**
 * Shared page state.
 * selection is the only field today. Add the next shared value beside it.
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
