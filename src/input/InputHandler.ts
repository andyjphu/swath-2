import { Camera } from '../rendering/Camera';
import { EventBus } from '../core/EventBus';

export class InputHandler {
  private isPanning = false;
  private lastX = 0;
  private lastY = 0;

  private keysDown = new Set<string>();
  private panSpeed = 880; // pixels per second at zoom 1
  private velX = 0;
  private velY = 0;
  private lastTime = 0;
  private readonly accel = 25; // how fast velocity ramps up (snappier)
  private readonly friction = 20; // how fast velocity decays (snappier)

  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        if (e.key.startsWith('Arrow')) e.preventDefault();
        this.keysDown.add(e.key);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
    });

    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05); // seconds, capped
      this.lastTime = now;

      let targetX = 0, targetY = 0;
      if (this.keysDown.has('ArrowLeft') || this.keysDown.has('a')) targetX += 1;
      if (this.keysDown.has('ArrowRight') || this.keysDown.has('d')) targetX -= 1;
      if (this.keysDown.has('ArrowUp') || this.keysDown.has('w')) targetY += 1;
      if (this.keysDown.has('ArrowDown') || this.keysDown.has('s')) targetY -= 1;

      const speed = this.panSpeed * this.camera.zoom;

      if (targetX !== 0 || targetY !== 0) {
        // Accelerate toward target
        this.velX += (targetX * speed - this.velX) * this.accel * dt;
        this.velY += (targetY * speed - this.velY) * this.accel * dt;
      } else {
        // Decelerate
        this.velX *= Math.max(0, 1 - this.friction * dt);
        this.velY *= Math.max(0, 1 - this.friction * dt);
        if (Math.abs(this.velX) < 0.5) this.velX = 0;
        if (Math.abs(this.velY) < 0.5) this.velY = 0;
      }

      if (this.velX !== 0 || this.velY !== 0) {
        this.camera.onDrag(this.velX * dt, this.velY * dt);
      }

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
