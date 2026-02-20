/** 2D orthographic camera with pan, zoom, and viewport offset support. */
export class Camera {
  /** Camera center in world space */
  private x = 0;
  private y = 0;
  /** Zoom level (pixels per world unit) */
  private _zoom = 1;
  /** Canvas dimensions */
  private canvasWidth = 1;
  private canvasHeight = 1;
  /** Viewport offset to shift the projection center (sidebar compensation) */
  private offsetX = 0;
  private offsetY = 0;

  /** Animation state */
  private animating = false;
  private animStartX = 0;
  private animStartY = 0;
  private animStartZoom = 1;
  private animTargetX = 0;
  private animTargetY = 0;
  private animTargetZoom = 1;
  private animStartTime = 0;
  private animDuration = 300;

  get zoom(): number {
    return this._zoom;
  }

  /** Whether camera is currently animating. */
  get isAnimating(): boolean {
    return this.animating;
  }

  /** Set canvas dimensions */
  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /** Set viewport offset (e.g. sidebar width on desktop, sidebar height on mobile) */
  setViewportOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /** Fit all positions into view with padding */
  fitToContent(positions: Float32Array, padding: number = 50): void {
    if (positions.length < 2) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < positions.length; i += 2) {
      const px = positions[i];
      const py = positions[i + 1];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    this.x = (minX + maxX) / 2;
    this.y = (minY + maxY) / 2;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Available viewport (accounting for offset)
    const availableWidth =
      this.canvasWidth - Math.abs(this.offsetX) - padding * 2;
    const availableHeight =
      this.canvasHeight - Math.abs(this.offsetY) - padding * 2;

    if (contentWidth > 0 && contentHeight > 0) {
      this._zoom = Math.min(
        availableWidth / contentWidth,
        availableHeight / contentHeight
      );
    }
  }

  /** Pan by screen-space delta */
  pan(dx: number, dy: number): void {
    this.animating = false;
    this.x -= dx / this._zoom;
    this.y -= dy / this._zoom;
  }

  /** Zoom at a screen position */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    this.animating = false;
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    this._zoom *= factor;
    this._zoom = Math.max(0.01, Math.min(this._zoom, 200));
    // Adjust pan so the world point stays under the cursor
    const [wx2, wy2] = this.screenToWorld(screenX, screenY);
    this.x -= wx2 - wx;
    this.y -= wy2 - wy;
  }

  /** Set camera to look at a world position (instant) */
  lookAt(worldX: number, worldY: number, zoom?: number): void {
    this.animating = false;
    this.x = worldX;
    this.y = worldY;
    if (zoom !== undefined) {
      this._zoom = zoom;
    }
  }

  /** Animate camera to a world position over durationMs. Returns true while animating. */
  animateTo(
    worldX: number,
    worldY: number,
    zoom: number,
    durationMs: number = 300
  ): void {
    this.animStartX = this.x;
    this.animStartY = this.y;
    this.animStartZoom = this._zoom;
    this.animTargetX = worldX;
    this.animTargetY = worldY;
    this.animTargetZoom = zoom;
    this.animStartTime = performance.now();
    this.animDuration = durationMs;
    this.animating = true;
  }

  /** Advance animation. Returns true if still animating (needs another frame). */
  tick(): boolean {
    if (!this.animating) return false;
    const elapsed = performance.now() - this.animStartTime;
    const t = Math.min(elapsed / this.animDuration, 1);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3);
    this.x = this.animStartX + (this.animTargetX - this.animStartX) * ease;
    this.y = this.animStartY + (this.animTargetY - this.animStartY) * ease;
    this._zoom =
      this.animStartZoom + (this.animTargetZoom - this.animStartZoom) * ease;
    if (t >= 1) {
      this.animating = false;
    }
    return this.animating;
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(sx: number, sy: number): [number, number] {
    // Screen center, adjusted for offset
    const cx = this.canvasWidth / 2 + this.offsetX / 2;
    const cy = this.canvasHeight / 2 + this.offsetY / 2;
    return [(sx - cx) / this._zoom + this.x, (sy - cy) / this._zoom + this.y];
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(wx: number, wy: number): [number, number] {
    const cx = this.canvasWidth / 2 + this.offsetX / 2;
    const cy = this.canvasHeight / 2 + this.offsetY / 2;
    return [(wx - this.x) * this._zoom + cx, (wy - this.y) * this._zoom + cy];
  }

  /** Get a 3x3 view matrix as Float32Array for shaders.
   *  Transforms world-space positions to clip-space (-1..1). */
  getViewMatrix(): Float32Array {
    const sx = (2 * this._zoom) / this.canvasWidth;
    const sy = (2 * this._zoom) / this.canvasHeight;
    const tx =
      (-this.x * 2 * this._zoom) / this.canvasWidth +
      this.offsetX / this.canvasWidth;
    const ty =
      (this.y * 2 * this._zoom) / this.canvasHeight -
      this.offsetY / this.canvasHeight;

    // Column-major 3x3
    return new Float32Array([sx, 0, 0, 0, -sy, 0, tx, ty, 1]);
  }

  /** Get visible world-space AABB [minX, minY, maxX, maxY] */
  getVisibleBounds(): [number, number, number, number] {
    const [minX, minY] = this.screenToWorld(0, 0);
    const [maxX, maxY] = this.screenToWorld(
      this.canvasWidth,
      this.canvasHeight
    );
    return [
      Math.min(minX, maxX),
      Math.min(minY, maxY),
      Math.max(minX, maxX),
      Math.max(minY, maxY),
    ];
  }
}
