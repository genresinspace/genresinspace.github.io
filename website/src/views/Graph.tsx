import { useRef, useEffect, useState } from "react";

import { useDataContext } from "../data";
import type { SettingsData } from "../settings";
import { GraphView } from "./graph/GraphView";
import type { SearchMode } from "./graph/GraphViewLabels";
import { Notice } from "./components/Notice";
import { textStyles } from "./typography";

import "./graph.css";

/** A pending zoom-to-fit request. Object identity drives re-fires. */
export type ZoomRequest = { kind: "selection" | "path" };

/** Thin React wrapper that creates DOM elements and delegates to GraphView. */
export function Graph({
  settings,
  selectedId,
  setSelectedId,
  focusedId,
  path,
  noPathEndpoints,
  viewportOffsetX,
  viewportOffsetY,
  searchMode,
  onSetAsSource,
  onSetAsDestination,
  zoomRequest,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
  path: string[] | null;
  noPathEndpoints: { source: string; destination: string } | null;
  viewportOffsetX: number;
  viewportOffsetY: number;
  searchMode: SearchMode;
  onSetAsSource: ((nodeId: string) => void) | null;
  onSetAsDestination: ((nodeId: string) => void) | null;
  zoomRequest: ZoomRequest | null;
}) {
  const data = useDataContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<GraphView | null>(null);
  // Set when the WebGL renderer can't start (e.g. no WebGL2 support); we then
  // show a notice in the graph area and leave the rest of the app usable.
  const [glError, setGlError] = useState(false);

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
    noPathEndpoints,
    settings,
    searchMode,
    viewportOffsetX,
    viewportOffsetY,
  });
  propsRef.current = {
    selectedId,
    focusedId,
    path,
    noPathEndpoints,
    settings,
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
    let view: GraphView;
    try {
      view = new GraphView(
        canvas,
        labelContainer,
        data,
        p.settings,
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
          noPathEndpoints: p.noPathEndpoints,
          searchMode: p.searchMode,
          viewportOffsetX: p.viewportOffsetX,
          viewportOffsetY: p.viewportOffsetY,
        }
      );
    } catch (e) {
      // Most likely WebGL2 is unavailable; degrade to a notice and keep the
      // rest of the app (search, sidebar) working. viewRef stays null, so the
      // prop-forwarding effects below become no-ops.
      console.error("Graph: failed to initialise the WebGL renderer", e);
      setGlError(true);
      return;
    }
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate on data change; settings/callbacks are forwarded via setters
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
    viewRef.current?.setNoPathEndpoints(noPathEndpoints);
  }, [noPathEndpoints]);
  useEffect(() => {
    viewRef.current?.setSettings(settings);
  }, [settings]);
  useEffect(() => {
    viewRef.current?.setSearchMode(searchMode);
  }, [searchMode]);
  useEffect(() => {
    viewRef.current?.setViewportOffset(viewportOffsetX, viewportOffsetY);
  }, [viewportOffsetX, viewportOffsetY]);
  // Declared last so that selectedId/path have already been forwarded to the
  // view when this fires — the request resolves against fresh state.
  useEffect(() => {
    if (!zoomRequest) return;
    if (zoomRequest.kind === "path") {
      viewRef.current?.requestZoomToPath();
    } else {
      viewRef.current?.requestZoomToSelection();
    }
  }, [zoomRequest]);

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
      {glError && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-md">
            <Notice colour="yellow">
              <p className="font-semibold mb-1">
                Couldn&rsquo;t display the graph
              </p>
              <p className={textStyles.body}>
                Your browser doesn&rsquo;t support WebGL2, which the interactive
                graph needs to render. You can still search for genres and
                browse their details from the panels. Try updating your browser
                or enabling hardware acceleration.
              </p>
            </Notice>
          </div>
        </div>
      )}
    </div>
  );
}

/** Re-export SearchMode for consumers that imported it from the old Labels module. */
export type { SearchMode };
