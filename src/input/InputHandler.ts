import { Camera } from '../rendering/Camera';
import { EventBus } from '../core/EventBus';

export class InputHandler {
  private isPanning = false;
  private lastX = 0;
  private lastY = 0;

  private keysDown = new Set<string>();
  private panSpeed = 12;

  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.keysDown.add(e.key);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
    });

    const tick = () => {
      let dx = 0, dy = 0;
      if (this.keysDown.has('ArrowLeft')) dx += this.panSpeed;
      if (this.keysDown.has('ArrowRight')) dx -= this.panSpeed;
      if (this.keysDown.has('ArrowUp')) dy += this.panSpeed;
      if (this.keysDown.has('ArrowDown')) dy -= this.panSpeed;
      if (dx !== 0 || dy !== 0) this.camera.onDrag(dx, dy);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private onMouseDown(e: MouseEvent): void {
    // Right-click or middle-click to pan
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.camera.onDrag(dx, dy);
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = false;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.camera.onWheel(e.deltaY, e.clientX, e.clientY);
    EventBus.emit('camera-changed', {});
  }
}
