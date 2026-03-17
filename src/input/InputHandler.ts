import { Camera } from '../rendering/Camera';
import { TileMap } from '../map/TileMap';
import { Config } from '../core/Config';
import { EventBus } from '../core/EventBus';

export class InputHandler {
  private isPanning = false;
  private lastX = 0;
  private lastY = 0;

  // Click detection (distinguish from drag)
  private mouseDownX = 0;
  private mouseDownY = 0;
  private mouseDownButton = -1;

  private keysDown = new Set<string>();
  private panSpeed = 880;
  private velX = 0;
  private velY = 0;
  private lastTime = 0;
  private readonly accel = 25;
  private readonly friction = 20;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private tileMap?: TileMap,
  ) {
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
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      let targetX = 0, targetY = 0;
      if (this.keysDown.has('ArrowLeft') || this.keysDown.has('a')) targetX += 1;
      if (this.keysDown.has('ArrowRight') || this.keysDown.has('d')) targetX -= 1;
      if (this.keysDown.has('ArrowUp') || this.keysDown.has('w')) targetY += 1;
      if (this.keysDown.has('ArrowDown') || this.keysDown.has('s')) targetY -= 1;

      const speed = this.panSpeed * this.camera.zoom;

      if (targetX !== 0 || targetY !== 0) {
        this.velX += (targetX * speed - this.velX) * this.accel * dt;
        this.velY += (targetY * speed - this.velY) * this.accel * dt;
      } else {
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
    this.mouseDownX = e.clientX;
    this.mouseDownY = e.clientY;
    this.mouseDownButton = e.button;

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

    // Left-click detection: only if mouse didn't move much (not a drag)
    if (e.button === 0 && this.mouseDownButton === 0) {
      const dx = e.clientX - this.mouseDownX;
      const dy = e.clientY - this.mouseDownY;
      if (dx * dx + dy * dy < 25) {
        this.handleClick(e.clientX, e.clientY);
      }
    }
    this.mouseDownButton = -1;
  }

  private handleClick(screenX: number, screenY: number): void {
    if (!this.tileMap) return;

    const world = this.camera.screenToWorld(screenX, screenY);
    const tileX = Math.floor(world.x / Config.TILE_SIZE);
    const tileY = Math.floor(world.y / Config.TILE_SIZE);

    if (!this.tileMap.inBounds(tileX, tileY)) return;

    const idx = tileY * this.tileMap.width + tileX;
    const cityId = this.tileMap.cityId[idx];

    if (cityId !== 0) {
      EventBus.emit('city-clicked', { cityId, tileX, tileY });
    } else {
      EventBus.emit('tile-clicked', { tileX, tileY, owner: this.tileMap.owner[idx] });
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.camera.onWheel(e.deltaY, e.clientX, e.clientY);
    EventBus.emit('camera-changed', {});
  }
}
