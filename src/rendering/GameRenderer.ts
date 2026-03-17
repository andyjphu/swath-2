import { Camera } from './Camera';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';

export interface Layer {
  init(ctx: CanvasRenderingContext2D): void;
  tick(state: GameState): void;
  render(ctx: CanvasRenderingContext2D, camera: Camera): void;
  isWorldSpace: boolean;
}

export class GameRenderer {
  private layers: Layer[] = [];
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, private camera: Camera, private state: GameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.resize();

    window.addEventListener('resize', () => this.resize());

    EventBus.on<{ tick: number }>('tick', () => {
      for (const layer of this.layers) {
        layer.tick(this.state);
      }
    });

    EventBus.on<{ dt: number }>('render', () => {
      this.render();
    });
  }

  addLayer(layer: Layer): void {
    layer.init(this.ctx);
    this.layers.push(layer);
  }

  private resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * this.dpr;
    this.canvas.height = this.canvas.clientHeight * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private render(): void {
    const { panX, panY, zoom } = this.camera.getTransform();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);

    for (const layer of this.layers) {
      this.ctx.save();
      if (layer.isWorldSpace) {
        this.ctx.translate(panX, panY);
        this.ctx.scale(zoom, zoom);
      }
      layer.render(this.ctx, this.camera);
      this.ctx.restore();
    }
  }
}
