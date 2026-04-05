import { useRef, useEffect } from "react";

import { useDataContext } from "../data";
import { useTheme } from "../theme";
import type { SettingsData } from "../settings";
import { GraphView } from "./graph/GraphView";
import type { SearchMode } from "./graph/GraphViewLabels";

import "./graph.css";

/** Thin React wrapper that creates DOM elements and delegates to GraphView. */
export function Graph({
  settings,
  selectedId,
  setSelectedId,
  focusedId,
  path,
  viewportOffsetX,
  viewportOffsetY,
  searchMode,
  onSetAsSource,
  onSetAsDestination,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
  path: string[] | null;
  viewportOffsetX: number;
  viewportOffsetY: number;
  searchMode: SearchMode;
  onSetAsSource: ((nodeId: string) => void) | null;
  onSetAsDestination: ((nodeId: string) => void) | null;
}) {
  const data = useDataContext();
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<GraphView | null>(null);

  // Stable refs so the constructor effect can read current prop values
  const callbackRefs = useRef({
    setSelectedId,
    onSetAsSource,
    onSetAsDestination,
  });
  callbackRefs.current = { setSelectedId, onSetAsSource, onSetAsDestination };

  const propsRef = useRef({
    selectedId,
    focusedId,
    path,
    settings,
    theme,
    searchMode,
    viewportOffsetX,
    viewportOffsetY,
  });
  propsRef.current = {
    selectedId,
    focusedId,
    path,
    settings,
    theme,
    searchMode,
    viewportOffsetX,
    viewportOffsetY,
  };

  // Create GraphView once (recreate only if data changes)
  useEffect(() => {
    const canvas = canvasRef.current;
    const labelContainer = labelContainerRef.current;
    if (!canvas || !labelContainer) return;

    const p = propsRef.current;
    const view = new GraphView(
      canvas,
      labelContainer,
      data,
      p.settings,
      p.theme,
      {
        setSelectedId: (id) => callbackRefs.current.setSelectedId(id),
        onSetAsSource: (id) => callbackRefs.current.onSetAsSource?.(id),
        onSetAsDestination: (id) =>
          callbackRefs.current.onSetAsDestination?.(id),
      },
      {
        selectedId: p.selectedId,
        focusedId: p.focusedId,
        path: p.path,
        searchMode: p.searchMode,
        viewportOffsetX: p.viewportOffsetX,
        viewportOffsetY: p.viewportOffsetY,
      }
    );
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate on data change; settings/theme/callbacks are forwarded via setters
  }, [data]);

  // Forward prop changes to GraphView
  useEffect(() => {
    viewRef.current?.setSelectedId(selectedId);
  }, [selectedId]);
  useEffect(() => {
    viewRef.current?.setFocusedId(focusedId);
  }, [focusedId]);
  useEffect(() => {
    viewRef.current?.setPath(path);
  }, [path]);
  useEffect(() => {
    viewRef.current?.setSettings(settings);
  }, [settings]);
  useEffect(() => {
    viewRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    viewRef.current?.setSearchMode(searchMode);
  }, [searchMode]);
  useEffect(() => {
    viewRef.current?.setViewportOffset(viewportOffsetX, viewportOffsetY);
  }, [viewportOffsetX, viewportOffsetY]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: "none" }}
      />
      <div
        ref={labelContainerRef}
        className="absolute inset-0 overflow-hidden node-label-container"
        style={{
          pointerEvents: "none",
          willChange: "transform",
          transformOrigin: "0 0",
        }}
      />
    </div>
  );
}

/** Re-export SearchMode for consumers that imported it from the old Labels module. */
export type { SearchMode };
