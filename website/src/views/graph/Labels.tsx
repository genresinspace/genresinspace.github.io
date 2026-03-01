/** HTML label overlay with conflict-avoidance layout. */

import { useMemo, useRef, useCallback, type RefObject } from "react";

import {
  nodeColour,
  NodeColourLightnessDark,
  NodeColourLightnessLight,
  NodeData,
  useDataContext,
} from "../../data";
import { SettingsData } from "../../settings";
import { useTheme } from "../../theme";

import type { Camera } from "./Camera";
import { PathInfo } from "./pathInfo";

import "../graph.css";

const MAX_VISIBLE_LABELS = 60;
/** Labels stay at base size until zoom/dpr exceeds this, then grow proportionally. */
const LABEL_ZOOM_THRESHOLD = 1.5;
/** Fraction of full zoom-scaling applied to labels beyond the threshold (0=fixed, 1=full). */
const LABEL_ZOOM_RATE = 0.25;
const DRAG_THRESHOLD = 5;

type LabelCandidate = {
  nodeIndex: number;
  node: NodeData;
  screenX: number;
  screenY: number;
  fontSize: number;
  priority: number;
  /** Whether this label is in the selected coverage net */
  inSelectedNet: boolean;
  /** BFS distance from selected node (0 = selected, Infinity = not in net) */
  selectionDistance: number;
};

/** HTML label overlay with degree-prioritized conflict avoidance. */
export function Labels({
  settings,
  selectedId,
  setSelectedId,
  hoveredId,
  setHoveredId,
  pathInfo,
  camera,
  nodePositions,
  cameraVersion,
  onCameraChange,
  containerRef,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  pathInfo: PathInfo;
  camera: Camera;
  nodePositions: Float32Array;
  cameraVersion: number;
  onCameraChange: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const data = useDataContext();
  const { theme } = useTheme();
  const colorLightness =
    theme === "light" ? NodeColourLightnessLight : NodeColourLightnessDark;
  const maxDegree = data.max_degree;
  const maxDistance = settings.general.maxInfluenceDistance + 1;
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    totalDist: number;
    nodeId: string;
  } | null>(null);

  // Handle pointerdown on a label: track for drag vs click
  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        totalDist: 0,
        nodeId,
      };

      const onMove = (me: PointerEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const dx = me.clientX - state.startX;
        const dy = me.clientY - state.startY;
        state.totalDist += Math.sqrt(dx * dx + dy * dy);
        // Pan camera directly
        camera.pan(dx, dy);
        state.startX = me.clientX;
        state.startY = me.clientY;
        onCameraChange();
      };

      const onUp = () => {
        const state = dragStateRef.current;
        if (state && state.totalDist < DRAG_THRESHOLD) {
          // Click — toggle selection
          setSelectedId(selectedId === state.nodeId ? null : state.nodeId);
        }
        dragStateRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [camera, selectedId, setSelectedId, onCameraChange]
  );

  const stableLabels = useMemo(() => {
    if (!settings.general.showLabels)
      return { result: [] as LabelCandidate[], allCandidates: [] as LabelCandidate[] };

    const dpr = window.devicePixelRatio || 1;
    const [minX, minY, maxX, maxY] = camera.getVisibleBounds();

    // Build candidate list
    const candidates: LabelCandidate[] = [];

    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      const wx = nodePositions[i * 2];
      const wy = nodePositions[i * 2 + 1];

      // Skip off-screen nodes
      if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;

      const [sx, sy] = camera.worldToScreen(wx, wy);
      const baseFontSize = 10 + (node.edges.length / maxDegree) * 6;
      const zoomScale = camera.zoom / dpr;
      // At overview zoom, use full base size; once zoomed in enough,
      // transition to scaling with zoom at half rate
      // Beyond threshold, labels grow at LABEL_ZOOM_RATE of the full zoom rate
      const fullScale = zoomScale / LABEL_ZOOM_THRESHOLD;
      const fontSize = baseFontSize * Math.max(1, 1 + (fullScale - 1) * LABEL_ZOOM_RATE);

      const basePriority = node.edges.length;
      let priority = basePriority;
      let inSelectedNet = false;
      let selectionDistance = Infinity;

      // Check if in selection net
      if (selectedId) {
        if (node.id === selectedId) {
          priority += 100000;
          inSelectedNet = true;
          selectionDistance = 0;
        } else {
          const dist = pathInfo.nodeDistances.get(node.id);
          if (dist !== undefined && dist < maxDistance) {
            priority += 10000 - dist * 1000;
            inSelectedNet = true;
            selectionDistance = dist;
          }
          if (pathInfo.immediateNeighbours.has(node.id)) {
            priority += 10000;
            inSelectedNet = true;
            if (selectionDistance > 1) selectionDistance = 1;
          }
        }
      }

      candidates.push({
        nodeIndex: i,
        node,
        screenX: sx,
        screenY: sy,
        fontSize,
        priority,
        inSelectedNet,
        selectionDistance,
      });
    }

    // Placement tiers — selected-net first so it can never be displaced:
    // 1. Selected-net labels (sorted by priority)
    // 2. Other visible labels (sorted by degree)
    const selectedCandidates = candidates
      .filter((c) => c.inSelectedNet)
      .sort((a, b) => b.priority - a.priority);
    const otherCandidates = candidates
      .filter((c) => !c.inSelectedNet)
      .sort((a, b) => b.priority - a.priority);

    // Greedy overlap culling
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const result: LabelCandidate[] = [];

    const tryPlace = (c: LabelCandidate): boolean => {
      if (result.length >= MAX_VISIBLE_LABELS) return false;
      const charWidth = c.fontSize * 0.6;
      const w = c.node.label.length * charWidth * dpr + 16 * dpr;
      const h = (c.fontSize + 4) * dpr;
      const x = c.screenX - w / 2;
      const y = c.screenY - h;

      for (const p of placed) {
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) {
          return false;
        }
      }
      placed.push({ x, y, w, h });
      result.push(c);
      return true;
    };

    for (const c of selectedCandidates) tryPlace(c);
    for (const c of otherCandidates) tryPlace(c);

    return { result, allCandidates: candidates };
  }, [
    data.nodes,
    camera,
    nodePositions,
    settings.general.showLabels,
    selectedId,
    pathInfo,
    maxDegree,
    maxDistance,
    cameraVersion,
  ]);

  // Ensure hovered label is always shown, even if culled by overlap.
  // Computed outside the stable useMemo so hover doesn't cause remounts.
  const labels = useMemo(() => {
    const { result, allCandidates } = stableLabels;
    if (!hoveredId || result.some((c) => c.node.id === hoveredId)) {
      return result;
    }
    const hovered = allCandidates.find((c) => c.node.id === hoveredId);
    return hovered ? [...result, hovered] : result;
  }, [stableLabels, hoveredId]);

  const dpr = window.devicePixelRatio || 1;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: "none", willChange: "transform" }}
    >
      {labels.map((label) => {
        const bgColor = nodeColour(
          label.node,
          maxDegree,
          colorLightness.GraphLabelBackgroundBorder
        );
        const borderColor = nodeColour(
          label.node,
          maxDegree,
          colorLightness.GraphLabelBackground
        );
        const textColor = nodeColour(
          label.node,
          maxDegree,
          colorLightness.GraphLabelText
        );

        // Hover overrides all dimming — hovered labels are always fully visible
        const isHovered = hoveredId === label.node.id;
        let filterStyle: string | undefined;
        let opacityStyle = 1;
        if (isHovered) {
          filterStyle = "brightness(1.6)";
        } else if (selectedId) {
          if (label.inSelectedNet) {
            opacityStyle = label.selectionDistance <= 1
              ? 1.0
              : Math.pow(0.25, label.selectionDistance - 1);
          } else {
            filterStyle = "brightness(0.4)";
            opacityStyle = 0.2;
          }
        }

        return (
          <div
            key={label.node.id}
            className="node-label"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${label.screenX / dpr}px, ${label.screenY / dpr}px) translate(-50%, -100%)`,
              fontSize: `${label.fontSize}px`,
              backgroundColor: bgColor,
              borderBottom: `4px solid ${borderColor}`,
              color: textColor,
              filter: filterStyle,
              opacity: opacityStyle,
              whiteSpace: "nowrap",
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            onPointerEnter={() => setHoveredId(label.node.id)}
            onPointerLeave={() => {
              if (hoveredId === label.node.id) setHoveredId(null);
            }}
            onWheel={(e) => {
              // Forward wheel events to the camera so zoom works over labels
              const rect = containerRef.current!.getBoundingClientRect();
              const sx = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
              const sy = (e.clientY - rect.top) * (window.devicePixelRatio || 1);
              const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
              camera.smoothZoomAt(sx, sy, factor);
              onCameraChange();
            }}
            onPointerDown={(e) => onLabelPointerDown(e, label.node.id)}
          >
            {label.node.label}
          </div>
        );
      })}
    </div>
  );
}
