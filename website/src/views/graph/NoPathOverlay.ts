/**
 * The severed-connector overlay drawn between two route endpoints that have no
 * path between them: two dashed stubs reaching out from each star with a gap,
 * crossed by an ✕, so it reads as a broken connection rather than a real edge.
 *
 * It lives inside the label container so it rides the same per-frame transform
 * as the labels; `update()` is called whenever the labels are recommitted.
 */

import { nodeIdToInt } from "../../data";
import { Camera } from "./Camera";
import { NO_PATH_LINE_COLOR, NO_PATH_BREAK_COLOR } from "./graphConstants";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The two route endpoints the connector spans. */
export type Endpoints = { source: string; destination: string };

/** Manages the SVG severed-connector overlay for the no-path state. */
export class NoPathOverlay {
  private svg: SVGSVGElement;
  private seg1: SVGLineElement;
  private seg2: SVGLineElement;
  private cross1: SVGLineElement;
  private cross2: SVGLineElement;
  private endpoints: Endpoints | null = null;

  constructor(container: HTMLElement) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    svg.style.display = "none";

    const seg = () => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("stroke", NO_PATH_LINE_COLOR);
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "5 5");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-opacity", "0.6");
      svg.appendChild(line);
      return line;
    };
    const cross = () => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("stroke", NO_PATH_BREAK_COLOR);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-opacity", "0.95");
      svg.appendChild(line);
      return line;
    };

    this.seg1 = seg();
    this.seg2 = seg();
    this.cross1 = cross();
    this.cross2 = cross();

    container.appendChild(svg);
    this.svg = svg;
  }

  /** Set the endpoints to connect, or null to hide on the next update. */
  setEndpoints(endpoints: Endpoints | null): void {
    this.endpoints = endpoints;
  }

  /**
   * Position (or hide) the connector. Endpoints are projected with the current
   * camera, matching the screen space the labels are committed in.
   */
  update(camera: Camera, nodePositions: Float32Array, nodeCount: number): void {
    const ep = this.endpoints;
    if (!ep) {
      this.svg.style.display = "none";
      return;
    }

    const si = nodeIdToInt(ep.source);
    const di = nodeIdToInt(ep.destination);
    if (si < 0 || si >= nodeCount || di < 0 || di >= nodeCount) {
      this.svg.style.display = "none";
      return;
    }

    const [x1, y1] = camera.worldToScreen(
      nodePositions[si * 2],
      nodePositions[si * 2 + 1]
    );
    const [x2, y2] = camera.worldToScreen(
      nodePositions[di * 2],
      nodePositions[di * 2 + 1]
    );

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);

    // Gap left around the midpoint for the break marker, shrinking on short runs
    const gap = Math.min(14, len / 4);
    const ux = len > 0 ? dx / len : 0;
    const uy = len > 0 ? dy / len : 0;
    setLine(this.seg1, x1, y1, mx - ux * gap, my - uy * gap);
    setLine(this.seg2, mx + ux * gap, my + uy * gap, x2, y2);

    // A fixed-orientation ✕ over the gap reads as "no connection" at any angle
    const r = Math.min(6, gap * 0.7);
    setLine(this.cross1, mx - r, my - r, mx + r, my + r);
    setLine(this.cross2, mx - r, my + r, mx + r, my - r);

    this.svg.style.display = "block";
  }

  destroy(): void {
    this.svg.remove();
  }
}

function setLine(
  line: SVGLineElement,
  ax: number,
  ay: number,
  bx: number,
  by: number
): void {
  line.setAttribute("x1", String(ax));
  line.setAttribute("y1", String(ay));
  line.setAttribute("x2", String(bx));
  line.setAttribute("y2", String(by));
}
