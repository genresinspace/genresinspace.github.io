import { useMemo, useRef, useState, useCallback } from "react";

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
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
  path: string[] | null;
  viewportOffsetX: number;
  viewportOffsetY: number;
}) {
  const data = useDataContext();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Single shared camera instance used by both GraphCanvas and Labels
  const cameraRef = useRef<Camera>(new Camera());
  // Counter to trigger label re-renders when camera changes
  const [cameraVersion, setCameraVersion] = useState(0);
  const onCameraChange = useCallback(() => {
    setCameraVersion((v) => v + 1);
  }, []);

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

  // Compute coverage net for hovered node
  const hoverPathInfo = useMemo(() => {
    if (!hoveredId) return EMPTY_PATH_INFO;
    return getPathsWithinDistance(
      hoveredId,
      data.nodes,
      data.edges,
      settings.visibleTypes,
      maxDistance
    );
  }, [hoveredId, data.nodes, data.edges, maxDistance, settings.visibleTypes]);

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
        hoverPathInfo={hoverPathInfo}
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
        hoverPathInfo={hoverPathInfo}
        camera={cameraRef.current}
        nodePositions={nodePositions}
        cameraVersion={cameraVersion}
        onCameraChange={onCameraChange}
      />
    </div>
  );
}
