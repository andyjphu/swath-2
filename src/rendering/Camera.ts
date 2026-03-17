export class Camera {
  panX = 0;
  panY = 0;
  zoom = 1;

  private minZoom = 0.15;
  private maxZoom = 6;

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY,
    };
  }

  getTransform(): { panX: number; panY: number; zoom: number } {
    return { panX: this.panX, panY: this.panY, zoom: this.zoom };
  }

  onDrag(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  onWheel(delta: number, screenX: number, screenY: number): void {
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

    // Zoom toward cursor: keep the world point under cursor fixed
    const wx = (screenX - this.panX) / this.zoom;
    const wy = (screenY - this.panY) / this.zoom;

    this.zoom = newZoom;

    this.panX = screenX - wx * this.zoom;
    this.panY = screenY - wy * this.zoom;
  }
}
