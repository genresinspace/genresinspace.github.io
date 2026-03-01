/** HTML label overlay with conflict-avoidance layout. */

import { useMemo, useRef, useCallback } from "react";

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
};

/** HTML label overlay with degree-prioritized conflict avoidance. */
export function Labels({
  settings,
  selectedId,
  setSelectedId,
  pathInfo,
  camera,
  nodePositions,
  cameraVersion,
  onCameraChange,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  pathInfo: PathInfo;
  camera: Camera;
  nodePositions: Float32Array;
  cameraVersion: number;
  onCameraChange: () => void;
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

  const labels = useMemo(() => {
    if (!settings.general.showLabels) return [];

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
      const fontSize = 10 + (node.edges.length / maxDegree) * 6;

      const basePriority = node.edges.length;
      let priority = basePriority;
      let inSelectedNet = false;

      // Check if in selection net
      if (selectedId) {
        if (node.id === selectedId) {
          priority += 100000;
          inSelectedNet = true;
        } else {
          const dist = pathInfo.nodeDistances.get(node.id);
          if (dist !== undefined && dist < maxDistance) {
            priority += 10000 - dist * 1000;
            inSelectedNet = true;
          }
          if (pathInfo.immediateNeighbours.has(node.id)) {
            priority += 10000;
            inSelectedNet = true;
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
    const dpr = window.devicePixelRatio || 1;

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

    return result;
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

  const dpr = window.devicePixelRatio || 1;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: "none" }}
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

        // Determine filter:
        // - In selected net: prominent
        // - Not in selected net (when selection active): dimmed
        // - Default: no filter
        let filterStyle: string | undefined;
        let opacityStyle = 1;
        if (selectedId && !label.inSelectedNet) {
          filterStyle = "brightness(0.4)";
          opacityStyle = 0.5;
        } else if (label.inSelectedNet) {
          filterStyle = "brightness(1.3)";
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
            onPointerDown={(e) => onLabelPointerDown(e, label.node.id)}
          >
            {label.node.label}
          </div>
        );
      })}
    </div>
  );
}
