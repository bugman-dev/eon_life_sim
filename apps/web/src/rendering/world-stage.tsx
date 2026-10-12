import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Container } from "pixi.js";

/** The map view, as seen by a body that is not part of the map. */
export type WorldStage = {
  attachEntity: (container: Container) => void;
  detachEntity: (container: Container) => void;
  placeEntity: (container: Container, x: number, y: number) => void;
  attachOverlay: (container: Container) => void;
  detachOverlay: () => void;
  centerView: (x: number, y: number) => void;
};

type WorldStageContextValue = {
  stageVersion: number;
  viewVersion: number;
  registerStage: (stage: WorldStage | null) => void;
  noteViewFitted: () => void;
  attachEntity: (container: Container) => void;
  detachEntity: (container: Container) => void;
  placeEntity: (container: Container, x: number, y: number) => void;
  attachOverlay: (container: Container) => void;
  detachOverlay: () => void;
  centerView: (x: number, y: number) => void;
};

const WorldStageContext = createContext<WorldStageContextValue | null>(null);

export function WorldStageProvider({ children }: { children: ReactNode }) {
  const stageRef = useRef<WorldStage | null>(null);
  const [stageVersion, setStageVersion] = useState(0);
  const [viewVersion, setViewVersion] = useState(0);
  const registerStage = useCallback((stage: WorldStage | null) => {
    stageRef.current = stage;
    setStageVersion((version) => (stage ? version + 1 : 0));
  }, []);
  const noteViewFitted = useCallback(() => {
    setViewVersion((version) => version + 1);
  }, []);
  const attachEntity = useCallback((container: Container) => {
    stageRef.current?.attachEntity(container);
  }, []);
  const detachEntity = useCallback((container: Container) => {
    stageRef.current?.detachEntity(container);
  }, []);
  const placeEntity = useCallback((container: Container, x: number, y: number) => {
    stageRef.current?.placeEntity(container, x, y);
  }, []);
  const attachOverlay = useCallback((container: Container) => {
    stageRef.current?.attachOverlay(container);
  }, []);
  const detachOverlay = useCallback(() => {
    stageRef.current?.detachOverlay();
  }, []);
  const centerView = useCallback((x: number, y: number) => {
    stageRef.current?.centerView(x, y);
  }, []);
  const value = useMemo<WorldStageContextValue>(
    () => ({
      stageVersion,
      viewVersion,
      registerStage,
      noteViewFitted,
      attachEntity,
      detachEntity,
      placeEntity,
      attachOverlay,
      detachOverlay,
      centerView,
    }),
    [stageVersion, viewVersion, registerStage, noteViewFitted, attachEntity, detachEntity, placeEntity, attachOverlay, detachOverlay, centerView],
  );

  return <WorldStageContext.Provider value={value}>{children}</WorldStageContext.Provider>;
}

export function useWorldStage() {
  const value = useContext(WorldStageContext);
  if (!value) {
    throw new Error("useWorldStage must be used inside WorldStageProvider.");
  }
  return value;
}
