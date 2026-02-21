/** Mouse and touch input handler for the graph canvas. */

import { Camera } from "./Camera";

const CLICK_DISTANCE_THRESHOLD = 5;

/** Callbacks for graph interaction events. */
export type InteractionCallbacks = {
  onNodeClick: (nodeIndex: number | null) => void;
  onNodeHover: (nodeIndex: number | null) => void;
  onViewChange: () => void;
  hitTest: (worldX: number, worldY: number) => number | null;
};

type State = "idle" | "dragging" | "pinching";

/** Handles mouse and touch input for pan, zoom, click, and hover. */
export class InteractionHandler {
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private callbacks: InteractionCallbacks;
  private state: State = "idle";

  // Mouse drag state
  private dragStartX = 0;
  private dragStartY = 0;
  private totalDragDist = 0;

  // Pinch state
  private lastPinchDist = 0;
  private lastPinchCenterX = 0;
  private lastPinchCenterY = 0;

  // Bound handlers for cleanup
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(
    camera: Camera,
    canvas: HTMLCanvasElement,
    callbacks: InteractionCallbacks
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);

    canvas.addEventListener("mousedown", this.boundMouseDown);
    canvas.addEventListener("mousemove", this.boundMouseMove);
    canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    canvas.addEventListener("touchstart", this.boundTouchStart, {
      passive: false,
    });
    canvas.addEventListener("touchmove", this.boundTouchMove, {
      passive: false,
    });
    canvas.addEventListener("touchend", this.boundTouchEnd);
  }

  destroy(): void {
    this.canvas.removeEventListener("mousedown", this.boundMouseDown);
    this.canvas.removeEventListener("mousemove", this.boundMouseMove);
    this.canvas.removeEventListener("wheel", this.boundWheel);
    this.canvas.removeEventListener("touchstart", this.boundTouchStart);
    this.canvas.removeEventListener("touchmove", this.boundTouchMove);
    this.canvas.removeEventListener("touchend", this.boundTouchEnd);
    // Clean up any lingering window listeners
    window.removeEventListener("mousemove", this.boundMouseMove);
    window.removeEventListener("mouseup", this.boundMouseUp);
  }

  private onMouseDown(e: MouseEvent): void {
    this.state = "dragging";
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.totalDragDist = 0;
    // Listen on window so dragging works even when mouse moves over labels
    window.addEventListener("mousemove", this.boundMouseMove);
    window.addEventListener("mouseup", this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.state === "dragging") {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.totalDragDist += Math.sqrt(dx * dx + dy * dy);
      this.camera.pan(dx, dy);
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.callbacks.onViewChange();
    } else {
      // Hover
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wy] = this.camera.screenToWorld(
        sx * window.devicePixelRatio,
        sy * window.devicePixelRatio
      );
      const hit = this.callbacks.hitTest(wx, wy);
      this.callbacks.onNodeHover(hit);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    // Remove window-level listeners
    window.removeEventListener("mousemove", this.boundMouseMove);
    window.removeEventListener("mouseup", this.boundMouseUp);

    if (
      this.state === "dragging" &&
      this.totalDragDist < CLICK_DISTANCE_THRESHOLD
    ) {
      // This was a click
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wy] = this.camera.screenToWorld(
        sx * window.devicePixelRatio,
        sy * window.devicePixelRatio
      );
      const hit = this.callbacks.hitTest(wx, wy);
      this.callbacks.onNodeClick(hit);
    }
    this.state = "idle";
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * window.devicePixelRatio;
    const sy = (e.clientY - rect.top) * window.devicePixelRatio;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.camera.zoomAt(sx, sy, factor);
    this.callbacks.onViewChange();
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.state = "dragging";
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
      this.totalDragDist = 0;
    } else if (e.touches.length === 2) {
      this.state = "pinching";
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      this.lastPinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      this.lastPinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.state === "dragging" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - this.dragStartX;
      const dy = e.touches[0].clientY - this.dragStartY;
      this.totalDragDist += Math.sqrt(dx * dx + dy * dy);
      this.camera.pan(dx, dy);
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
      this.callbacks.onViewChange();
    } else if (this.state === "pinching" && e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // Zoom
      const factor = dist / this.lastPinchDist;
      const rect = this.canvas.getBoundingClientRect();
      this.camera.zoomAt(
        (centerX - rect.left) * window.devicePixelRatio,
        (centerY - rect.top) * window.devicePixelRatio,
        factor
      );

      // Pan
      this.camera.pan(
        centerX - this.lastPinchCenterX,
        centerY - this.lastPinchCenterY
      );

      this.lastPinchDist = dist;
      this.lastPinchCenterX = centerX;
      this.lastPinchCenterY = centerY;
      this.callbacks.onViewChange();
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (
      this.state === "dragging" &&
      this.totalDragDist < CLICK_DISTANCE_THRESHOLD &&
      e.changedTouches.length === 1
    ) {
      const touch = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;
      const [wx, wy] = this.camera.screenToWorld(
        sx * window.devicePixelRatio,
        sy * window.devicePixelRatio
      );
      const hit = this.callbacks.hitTest(wx, wy);
      this.callbacks.onNodeClick(hit);
    }
    if (e.touches.length === 0) {
      this.state = "idle";
    } else if (e.touches.length === 1) {
      // Went from pinch to single finger
      this.state = "dragging";
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
      this.totalDragDist = CLICK_DISTANCE_THRESHOLD + 1; // prevent click on release
    }
  }
}
