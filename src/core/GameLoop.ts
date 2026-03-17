import { Config } from './Config';
import { EventBus } from './EventBus';
import { GameState } from './GameState';

export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(private state: GameState) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  setSpeed(multiplier: number): void {
    this.state.speedMultiplier = multiplier;
    this.state.isPaused = multiplier === 0;
  }

  private frame(now: number): void {
    if (!this.running) return;

    const dt = now - this.lastTime;
    this.lastTime = now;

    if (!this.state.isPaused && this.state.speedMultiplier > 0) {
      this.accumulator += dt * this.state.speedMultiplier;
      while (this.accumulator >= Config.TICK_MS) {
        this.accumulator -= Config.TICK_MS;
        this.state.currentTick++;
        EventBus.emit('tick', { tick: this.state.currentTick });
      }
    }

    EventBus.emit('render', { dt });

    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }
}
