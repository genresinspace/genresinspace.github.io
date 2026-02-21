/** HTML label overlay with conflict-avoidance layout. */

import { useMemo, useRef, useCallback, useEffect, useState } from "react";

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
/** How long recently-hovered nodes remain visible after cursor moves away */
const HOVER_DECAY_MS = 500;

type LabelCandidate = {
  nodeIndex: number;
  node: NodeData;
  screenX: number;
  screenY: number;
  fontSize: number;
  priority: number;
  /** Priority used only for sorting within the selected tier (hover-independent) */
  selectedPriority: number;
  /** Whether this label is in the current hover coverage net */
  inHoverNet: boolean;
  /** Whether this label is in the selected coverage net */
  inSelectedNet: boolean;
  /** Whether this label was recently in a hover net (decaying) */
  inRecentHoverNet: boolean;
};

/** HTML label overlay with degree-prioritized conflict avoidance. */
export function Labels({
  settings,
  selectedId,
  setSelectedId,
  hoveredId,
  setHoveredId,
  pathInfo,
  hoverPathInfo,
  camera,
  nodePositions,
  cameraVersion,
  onCameraChange,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  pathInfo: PathInfo;
  hoverPathInfo: PathInfo;
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

  // Time-based hover decay: track which node IDs were recently in a hover net.
  // Maps nodeId → timestamp when it was last part of a hover net.
  const recentHoverRef = useRef<Map<string, number>>(new Map());

  // Force a re-render after HOVER_DECAY_MS so decayed labels get cleaned up
  const [decayTick, setDecayTick] = useState(0);
  useEffect(() => {
    const timer = setTimeout(
      () => setDecayTick((v) => v + 1),
      HOVER_DECAY_MS + 16
    );
    return () => clearTimeout(timer);
  }, [hoveredId]);

  // Update recent hover timestamps whenever hoveredId/hoverPathInfo changes
  const now = performance.now();
  if (hoveredId) {
    recentHoverRef.current.set(hoveredId, now);
    for (const [id] of hoverPathInfo.nodeDistances) {
      recentHoverRef.current.set(id, now);
    }
  }
  // Prune entries older than decay window
  for (const [id, t] of recentHoverRef.current) {
    if (now - t > HOVER_DECAY_MS) {
      recentHoverRef.current.delete(id);
    }
  }

  // Hover lock: prevent flickering when a newly-appeared label lands under
  // a stationary cursor. After a label triggers hover, lock further
  // mouseenter events until the cursor moves at least a few pixels.
  const hoverLockRef = useRef<{ x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LABEL_HOVER_DEBOUNCE_MS = 80;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const lock = hoverLockRef.current;
      if (!lock) return;
      const dx = e.clientX - lock.x;
      const dy = e.clientY - lock.y;
      if (dx * dx + dy * dy > 9) {
        hoverLockRef.current = null;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const onLabelMouseEnter = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (hoverLockRef.current) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        hoverLockRef.current = { x: e.clientX, y: e.clientY };
        setHoveredId(nodeId);
        hoverTimerRef.current = null;
      }, LABEL_HOVER_DEBOUNCE_MS);
    },
    [setHoveredId]
  );

  const onLabelMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverLockRef.current = null;
    setHoveredId(null);
  }, [setHoveredId]);

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

  // Snapshot recent hover set for useMemo (refs aren't deps)
  // Snapshot of recently-hovered node IDs, recomputed on hover/camera/decay changes
  const recentHoverSnapshot = useMemo(
    () => new Set(recentHoverRef.current.keys()),
    [hoveredId, cameraVersion, decayTick] // eslint-disable-line
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
      let selectedPriority = basePriority;
      let priority = basePriority;
      let inSelectedNet = false;
      let inHoverNet = false;
      const inRecentHoverNet = recentHoverSnapshot.has(node.id);

      // Check if in selection net — builds selectedPriority (hover-independent)
      if (selectedId) {
        if (node.id === selectedId) {
          selectedPriority += 100000;
          priority += 100000;
          inSelectedNet = true;
        } else {
          const dist = pathInfo.nodeDistances.get(node.id);
          if (dist !== undefined && dist < maxDistance) {
            selectedPriority += 10000 - dist * 1000;
            priority += 10000 - dist * 1000;
            inSelectedNet = true;
          }
          if (pathInfo.immediateNeighbours.has(node.id)) {
            selectedPriority += 10000;
            priority += 10000;
            inSelectedNet = true;
          }
        }
      }

      // Check if in current hover net — only affects `priority`, not `selectedPriority`
      if (hoveredId) {
        if (node.id === hoveredId) {
          priority += 200000;
          inHoverNet = true;
        } else {
          const hDist = hoverPathInfo.nodeDistances.get(node.id);
          if (hDist !== undefined && hDist < maxDistance) {
            priority += 20000 - hDist * 1000;
            inHoverNet = true;
          }
        }
      }

      // Boost recently-hovered nodes so they stay visible
      if (inRecentHoverNet && !inHoverNet && !inSelectedNet) {
        priority += 5000;
      }

      candidates.push({
        nodeIndex: i,
        node,
        screenX: sx,
        screenY: sy,
        fontSize,
        priority,
        selectedPriority,
        inHoverNet,
        inSelectedNet,
        inRecentHoverNet,
      });
    }

    // Placement tiers — selected-net first so it can never be displaced:
    // 1. Selected-net labels
    // 2. Current hover-net labels
    // 3. Recently-hovered labels (decaying)
    // 4. Other visible labels (degree-based)
    const selectedCandidates = candidates
      .filter((c) => c.inSelectedNet)
      .sort((a, b) => b.selectedPriority - a.selectedPriority);
    const hoverCandidates = candidates
      .filter((c) => c.inHoverNet && !c.inSelectedNet)
      .sort((a, b) => b.priority - a.priority);
    const recentCandidates = candidates
      .filter((c) => c.inRecentHoverNet && !c.inHoverNet && !c.inSelectedNet)
      .sort((a, b) => b.priority - a.priority);
    const otherCandidates = candidates
      .filter((c) => !c.inSelectedNet && !c.inHoverNet && !c.inRecentHoverNet)
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
    for (const c of hoverCandidates) tryPlace(c);
    for (const c of recentCandidates) tryPlace(c);
    for (const c of otherCandidates) tryPlace(c);

    return result;
  }, [
    data.nodes,
    camera,
    nodePositions,
    settings.general.showLabels,
    selectedId,
    hoveredId,
    pathInfo,
    hoverPathInfo,
    maxDegree,
    maxDistance,
    cameraVersion,
    recentHoverSnapshot,
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
        const isHovered = hoveredId === label.node.id;
        const hasActiveNet = !!(selectedId || hoveredId);
        const inAnyNet =
          label.inHoverNet || label.inSelectedNet || label.inRecentHoverNet;

        // Determine filter:
        // - Hovered node itself: bright highlight
        // - In selected net: prominent
        // - In current hover net: subtler preview
        // - Recently hovered (decaying): same as hover net
        // - Not in any net (when one is active): dimmed
        let filterStyle: string | undefined;
        let opacityStyle = 1;
        if (isHovered) {
          filterStyle = "brightness(1.6)";
        } else if (hasActiveNet && !inAnyNet) {
          filterStyle = "brightness(0.4)";
          opacityStyle = 0.5;
        } else if (label.inSelectedNet) {
          filterStyle = "brightness(1.3)";
        } else if (label.inHoverNet) {
          filterStyle = "brightness(0.9)";
        } else if (label.inRecentHoverNet) {
          filterStyle = "brightness(0.7)";
          opacityStyle = 0.7;
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
            onMouseEnter={(e) => onLabelMouseEnter(e, label.node.id)}
            onMouseLeave={onLabelMouseLeave}
            onPointerDown={(e) => onLabelPointerDown(e, label.node.id)}
          >
            {label.node.label}
          </div>
        );
      })}
    </div>
  );
}
