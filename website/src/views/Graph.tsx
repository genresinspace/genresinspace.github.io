import { useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";

import { useDataContext } from "../data";
import { SettingsData } from "../settings";

import { Camera } from "./graph/Camera";
import { GraphCanvas } from "./graph/GraphCanvas";
import { Labels } from "./graph/Labels";
import { getPathsWithinDistance, EMPTY_PATH_INFO } from "./graph/pathInfo";

/** Graph component using custom WebGL renderer with precomputed positions. */
export function Graph({
  settings,
  selectedId,
  setSelectedId,
  focusedId,
  path,
  viewportOffsetX,
  viewportOffsetY,
  onCameraAnimatingChange,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
  path: string[] | null;
  viewportOffsetX: number;
  viewportOffsetY: number;
  onCameraAnimatingChange?: (animating: boolean) => void;
}) {
  const data = useDataContext();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Single shared camera instance used by both GraphCanvas and Labels
  const cameraRef = useRef<Camera>(new Camera());
  // Counter to trigger label re-renders when camera changes
  const [cameraVersion, setCameraVersion] = useState(0);

  // Direct DOM refs for instant label tracking (avoids React re-render lag)
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const labelSnapshotRef = useRef({ x: 0, y: 0, zoom: 1, screenCenterX: 0, screenCenterY: 0 });
  const wasAnimatingRef = useRef(false);
  const onCameraAnimatingChangeRef = useRef(onCameraAnimatingChange);
  onCameraAnimatingChangeRef.current = onCameraAnimatingChange;

  const onCameraChange = useCallback(() => {
    // Notify parent when camera animation starts/stops
    const isAnim = cameraRef.current.isAnimating;
    if (isAnim !== wasAnimatingRef.current) {
      wasAnimatingRef.current = isAnim;
      onCameraAnimatingChangeRef.current?.(isAnim);
    }
    // Apply CSS transform to labels container immediately (same frame as WebGL)
    const container = labelContainerRef.current;
    if (container) {
      const snap = labelSnapshotRef.current;
      const state = cameraRef.current.getState();
      const dpr = window.devicePixelRatio || 1;
      if (snap.zoom > 0) {
        const s = state.zoom / snap.zoom;
        const tx = (snap.x - state.x) * state.zoom / dpr;
        const ty = (snap.y - state.y) * state.zoom / dpr;
        container.style.transformOrigin = `${state.screenCenterX / dpr}px ${state.screenCenterY / dpr}px`;
        container.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      }
    }
    // Trigger React re-layout for label visibility/overlap recalculation
    setCameraVersion((v) => v + 1);
  }, []);

  // After React commits new label positions, reset the container transform
  // and snapshot the camera state. useLayoutEffect runs before browser paint,
  // so there's no flash of double-transformed labels.
  useLayoutEffect(() => {
    labelSnapshotRef.current = cameraRef.current.getState();
    const container = labelContainerRef.current;
    if (container) {
      container.style.transform = "";
      container.style.transformOrigin = "";
    }
  }, [cameraVersion]);

  const maxDistance = settings.general.maxInfluenceDistance + 1;

  // Compute coverage net for selected node
  const pathInfo = useMemo(() => {
    if (!selectedId) return EMPTY_PATH_INFO;
    return getPathsWithinDistance(
      selectedId,
      data.nodes,
      data.edges,
      settings.visibleTypes,
      maxDistance
    );
  }, [selectedId, data.nodes, data.edges, maxDistance, settings.visibleTypes]);

  // Precompute positions flat array for Labels
  const nodePositions = useMemo(() => {
    const arr = new Float32Array(data.nodes.length * 2);
    for (let i = 0; i < data.nodes.length; i++) {
      arr[i * 2] = data.nodes[i].x;
      arr[i * 2 + 1] = data.nodes[i].y;
    }
    return arr;
  }, [data.nodes]);

  return (
    <div className="relative w-full h-full">
      <GraphCanvas
        settings={settings}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        focusedId={focusedId}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        pathInfo={pathInfo}
        path={path}
        viewportOffsetX={viewportOffsetX}
        viewportOffsetY={viewportOffsetY}
        camera={cameraRef.current}
        onCameraChange={onCameraChange}
      />
      <Labels
        settings={settings}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        pathInfo={pathInfo}
        camera={cameraRef.current}
        nodePositions={nodePositions}
        cameraVersion={cameraVersion}
        onCameraChange={onCameraChange}
        containerRef={labelContainerRef}
      />
    </div>
  );
}
