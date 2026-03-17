import { TileMap } from '../map/TileMap';
import { RiverSystem } from '../map/RiverSystem';
import { TerrainType, TerrainConfigs } from '../map/Terrain';
import { Camera } from '../rendering/Camera';
import { Config, setMapSize } from '../core/Config';
import { smoothCoastlines, removeSmallIslands, fillSmallLakes, blurTerrain, erodePeninsulas, fillInlandWater } from '../map/MapFilters';


interface BrushType {
  name: string;
  terrain: TerrainType;
  color: string;
  key: string;
}

const BRUSHES: BrushType[] = [
  { name: 'Water', terrain: TerrainType.WATER, color: '#2d5a8e', key: '1' },
  { name: 'Plains', terrain: TerrainType.PLAINS, color: '#7cad3e', key: '2' },
  { name: 'Forest', terrain: TerrainType.FOREST, color: '#3d7a2a', key: '3' },
  { name: 'Hills', terrain: TerrainType.HILLS, color: '#a89060', key: '4' },
  { name: 'Mountains', terrain: TerrainType.MOUNTAINS, color: '#8a8a8a', key: '5' },
];

// History entry for undo
interface HistoryEntry {
  tiles: { idx: number; oldTerrain: number; newTerrain: number }[];
  rivers: { x: number; y: number; added: boolean }[];
}

type EditorMode = 'paint' | 'crop';

export class MapEditor {
  private activeBrush = 1; // default to Plains
  private brushSize = 3;
  private isPainting = false;
  private mode: EditorMode = 'paint';
  private container: HTMLDivElement;
  private brushSizeLabel: HTMLSpanElement;
  private history: HistoryEntry[] = [];
  private currentStroke: HistoryEntry | null = null;
  private maxHistory = 50;

  // Crop state — bounding box in tile coords
  private cropBox = { x1: 0, y1: 0, x2: 0, y2: 0 };
  private cropDragEdge: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null = null;
  private cropOverlay: HTMLCanvasElement | null = null;
  private cropAnimFrame = 0;

  constructor(
    private tileMap: TileMap,
    private rivers: RiverSystem,
    private camera: Camera,
    private canvas: HTMLCanvasElement,
    private onTerrainChanged: () => void,
  ) {
    this.container = this.createUI();
    document.getElementById('ui-root')!.appendChild(this.container);
    this.brushSizeLabel = this.container.querySelector('#brush-size-label')!;

    this.setupInputHandlers();
    this.setupKeyboardShortcuts();
    this.updateUI();
  }

  private createUI(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'map-editor';
    container.innerHTML = `
      <style>
        #map-editor {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(20, 20, 40, 0.92);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          min-width: 180px;
          pointer-events: auto;
          user-select: none;
        }
        #map-editor h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .brush-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 5px 8px;
          margin: 2px 0;
          border: 1px solid transparent;
          border-radius: 4px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          text-align: left;
        }
        .brush-btn:hover { background: rgba(255,255,255,0.12); }
        .brush-btn.active { border-color: #fff; background: rgba(255,255,255,0.18); }
        .brush-swatch {
          width: 16px;
          height: 16px;
          border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.3);
          flex-shrink: 0;
        }
        .brush-key {
          margin-left: auto;
          opacity: 0.4;
          font-size: 11px;
        }
        .editor-section {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .editor-section label {
          display: block;
          margin-bottom: 4px;
          font-size: 11px;
          opacity: 0.7;
        }
        .size-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .size-control input[type=range] {
          flex: 1;
          accent-color: #7cad3e;
        }
        .action-btn {
          display: block;
          width: 100%;
          padding: 7px;
          margin: 4px 0;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          background: rgba(255,255,255,0.08);
          color: #fff;
          cursor: pointer;
          font-size: 12px;
        }
        .action-btn:hover { background: rgba(255,255,255,0.16); }
        .shortcuts {
          margin-top: 8px;
          font-size: 10px;
          opacity: 0.4;
          line-height: 1.6;
        }
      </style>
      <h3>Map Editor</h3>
      <div id="brush-list"></div>
      <div class="editor-section">
        <label>Brush Size</label>
        <div class="size-control">
          <input type="range" id="brush-size" min="1" max="20" value="3">
          <span id="brush-size-label">3</span>
        </div>
      </div>
      <div class="editor-section">
        <label>Filters</label>
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <button class="action-btn" id="btn-smooth" style="flex:1;margin:0">Smooth Coast</button>
          <input type="number" id="smooth-passes" value="1" min="1" max="10" style="width:40px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;font-size:11px;text-align:center">
        </div>
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <button class="action-btn" id="btn-rm-islands" style="flex:1;margin:0">Remove Islands</button>
          <input type="number" id="island-min" value="50" min="1" max="5000" step="10" style="width:52px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;font-size:11px;text-align:center">
        </div>
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <button class="action-btn" id="btn-fill-lakes" style="flex:1;margin:0">Fill Lakes</button>
          <input type="number" id="lake-min" value="100" min="1" max="5000" step="10" style="width:52px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;font-size:11px;text-align:center">
        </div>
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <button class="action-btn" id="btn-blur" style="flex:1;margin:0">Blur Terrain</button>
          <input type="number" id="blur-radius" value="2" min="1" max="10" style="width:40px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;font-size:11px;text-align:center">
        </div>
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <button class="action-btn" id="btn-erode" style="flex:1;margin:0">Erode Peninsulas</button>
          <select id="erode-mode" style="width:52px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:2px;font-size:11px">
            <option value="manhattan">4-dir</option>
            <option value="diagonal">8-dir</option>
          </select>
        </div>
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <button class="action-btn" id="btn-fill-inland" style="flex:1;margin:0">Fill Inland Water</button>
          <select id="fill-inland-mode" style="width:52px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:2px;font-size:11px">
            <option value="diagonal">8-dir</option>
            <option value="manhattan">4-dir</option>
          </select>
        </div>
      </div>
      <div class="editor-section">
        <label>Tools</label>
        <button class="action-btn" id="btn-crop" style="margin-bottom:0">Crop Map</button>
        <div id="crop-controls" style="display:none;margin-top:6px">
          <div id="crop-size" style="font-size:11px;opacity:0.6;margin-bottom:6px"></div>
          <div style="font-size:10px;opacity:0.5;margin-bottom:6px">Drag edges or corners to resize</div>
          <div style="display:flex;gap:4px">
            <button class="action-btn" id="btn-crop-apply" style="flex:1;margin:0;background:rgba(100,200,100,0.2)">Apply</button>
            <button class="action-btn" id="btn-crop-cancel" style="flex:1;margin:0">Cancel</button>
          </div>
        </div>
      </div>
      <div class="editor-section">
        <button class="action-btn" id="btn-undo">Undo (Ctrl+Z)</button>
        <button class="action-btn" id="btn-save">Save Map (Ctrl+S)</button>
        <button class="action-btn" id="btn-load">Load Map</button>
        <input type="file" id="file-input" accept=".png" style="display:none">
      </div>
      <div class="shortcuts">
        Scroll = zoom | RightDrag = pan<br>
        Arrows = pan | [ / ] = brush size<br>
        1-5 = select brush
      </div>
    `;

    // Build brush buttons
    const list = container.querySelector('#brush-list')!;
    BRUSHES.forEach((brush, i) => {
      const btn = document.createElement('button');
      btn.className = 'brush-btn';
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <span class="brush-swatch" style="background:${brush.color}"></span>
        ${brush.name}
        <span class="brush-key">${brush.key}</span>
      `;
      btn.addEventListener('click', () => {
        this.activeBrush = i;
        this.updateUI();
      });
      list.appendChild(btn);
    });

    // Brush size slider
    container.querySelector('#brush-size')!.addEventListener('input', (e) => {
      this.brushSize = parseInt((e.target as HTMLInputElement).value);
      this.brushSizeLabel.textContent = String(this.brushSize);
    });

    // Filter buttons
    container.querySelector('#btn-smooth')!.addEventListener('click', () => {
      const passes = parseInt((container.querySelector('#smooth-passes') as HTMLInputElement).value) || 1;
      this.snapshotForUndo();
      smoothCoastlines(this.tileMap, passes);
      this.onTerrainChanged();
    });
    container.querySelector('#btn-rm-islands')!.addEventListener('click', () => {
      const minSize = parseInt((container.querySelector('#island-min') as HTMLInputElement).value) || 50;
      this.snapshotForUndo();
      removeSmallIslands(this.tileMap, minSize);
      this.onTerrainChanged();
    });
    container.querySelector('#btn-fill-lakes')!.addEventListener('click', () => {
      const minSize = parseInt((container.querySelector('#lake-min') as HTMLInputElement).value) || 100;
      this.snapshotForUndo();
      fillSmallLakes(this.tileMap, minSize);
      this.onTerrainChanged();
    });
    container.querySelector('#btn-blur')!.addEventListener('click', () => {
      const radius = parseInt((container.querySelector('#blur-radius') as HTMLInputElement).value) || 2;
      this.snapshotForUndo();
      blurTerrain(this.tileMap, radius);
      this.onTerrainChanged();
    });
    container.querySelector('#btn-erode')!.addEventListener('click', () => {
      const mode = (container.querySelector('#erode-mode') as HTMLSelectElement).value as 'manhattan' | 'diagonal';
      this.snapshotForUndo();
      erodePeninsulas(this.tileMap, mode);
      this.onTerrainChanged();
    });
    container.querySelector('#btn-fill-inland')!.addEventListener('click', () => {
      const mode = (container.querySelector('#fill-inland-mode') as HTMLSelectElement).value as 'manhattan' | 'diagonal';
      this.snapshotForUndo();
      fillInlandWater(this.tileMap, mode);
      this.onTerrainChanged();
    });

    // Crop tool
    container.querySelector('#btn-crop')!.addEventListener('click', () => this.enterCropMode());
    container.querySelector('#btn-crop-apply')!.addEventListener('click', () => this.applyCrop());
    container.querySelector('#btn-crop-cancel')!.addEventListener('click', () => this.exitCropMode());

    // Action buttons
    container.querySelector('#btn-undo')!.addEventListener('click', () => this.undo());
    container.querySelector('#btn-save')!.addEventListener('click', () => this.saveMap());
    container.querySelector('#btn-load')!.addEventListener('click', () => {
      (container.querySelector('#file-input') as HTMLInputElement).click();
    });
    container.querySelector('#file-input')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.loadMap(file);
    });

    return container;
  }

  private updateUI(): void {
    const buttons = this.container.querySelectorAll('.brush-btn');
    buttons.forEach((btn, i) => {
      btn.classList.toggle('active', i === this.activeBrush);
    });
  }

  private setupInputHandlers(): void {
    let lastTileX = -1;
    let lastTileY = -1;

    // Create crop overlay canvas (sits on top of game canvas)
    this.cropOverlay = document.createElement('canvas');
    this.cropOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10';
    document.getElementById('ui-root')!.appendChild(this.cropOverlay);
    const resizeOverlay = () => {
      const dpr = window.devicePixelRatio || 1;
      this.cropOverlay!.width = this.canvas.clientWidth * dpr;
      this.cropOverlay!.height = this.canvas.clientHeight * dpr;
      this.cropOverlay!.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeOverlay();
    window.addEventListener('resize', resizeOverlay);

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('#map-editor')) return;

      if (this.mode === 'crop') {
        this.cropDragEdge = this.getCropEdgeAt(e.clientX, e.clientY);
        return;
      }

      this.isPainting = true;
      this.currentStroke = { tiles: [], rivers: [] };
      lastTileX = -1;
      lastTileY = -1;
      this.paintAt(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.mode === 'crop') {
        if (this.cropDragEdge) {
          const world = this.camera.screenToWorld(e.clientX, e.clientY);
          const tx = Math.floor(world.x / Config.TILE_SIZE);
          const ty = Math.floor(world.y / Config.TILE_SIZE);
          this.updateCropEdge(tx, ty);
          this.drawCropOverlay();
        } else {
          // Update cursor on hover to show draggable edges
          const edge = this.getCropEdgeAt(e.clientX, e.clientY);
          if (edge === 'top' || edge === 'bottom') this.canvas.style.cursor = 'ns-resize';
          else if (edge === 'left' || edge === 'right') this.canvas.style.cursor = 'ew-resize';
          else if (edge === 'topLeft' || edge === 'bottomRight') this.canvas.style.cursor = 'nwse-resize';
          else if (edge === 'topRight' || edge === 'bottomLeft') this.canvas.style.cursor = 'nesw-resize';
          else this.canvas.style.cursor = '';
        }
        return;
      }

      if (!this.isPainting) return;
      const world = this.camera.screenToWorld(e.clientX, e.clientY);
      const tileX = Math.floor(world.x / Config.TILE_SIZE);
      const tileY = Math.floor(world.y / Config.TILE_SIZE);

      if (tileX === lastTileX && tileY === lastTileY) return;

      if (lastTileX >= 0) {
        const dx = Math.abs(tileX - lastTileX);
        const dy = Math.abs(tileY - lastTileY);
        const steps = Math.max(dx, dy);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const ix = Math.round(lastTileX + (tileX - lastTileX) * t);
          const iy = Math.round(lastTileY + (tileY - lastTileY) * t);
          this.applyBrush(ix, iy);
        }
      } else {
        this.applyBrush(tileX, tileY);
      }

      lastTileX = tileX;
      lastTileY = tileY;
      this.onTerrainChanged();
    });

    this.canvas.addEventListener('mouseup', () => {
      if (this.mode === 'crop') {
        this.cropDragEdge = null;
        return;
      }

      if (this.isPainting && this.currentStroke && this.currentStroke.tiles.length + this.currentStroke.rivers.length > 0) {
        this.history.push(this.currentStroke);
        if (this.history.length > this.maxHistory) this.history.shift();
      }
      this.isPainting = false;
      this.currentStroke = null;
    });
  }

  private enterCropMode(): void {
    this.mode = 'crop';
    // Init crop box to full map
    this.cropBox = { x1: 0, y1: 0, x2: this.tileMap.width - 1, y2: this.tileMap.height - 1 };
    this.container.querySelector('#crop-controls')!.setAttribute('style', 'display:block;margin-top:6px');
    // Show overlay
    if (this.cropOverlay) this.cropOverlay.style.display = '';
    this.drawCropOverlay();
    this.startCropRenderLoop();
    this.updateCropSizeLabel();
  }

  private exitCropMode(): void {
    this.mode = 'paint';
    this.canvas.style.cursor = '';
    this.cropDragEdge = null;
    this.container.querySelector('#crop-controls')!.setAttribute('style', 'display:none');
    cancelAnimationFrame(this.cropAnimFrame);
    this.clearCropOverlay();
    // Hide overlay entirely so no ghost pixels remain
    if (this.cropOverlay) this.cropOverlay.style.display = 'none';
  }

  private startCropRenderLoop(): void {
    const loop = () => {
      if (this.mode !== 'crop') return;
      this.drawCropOverlay();
      this.cropAnimFrame = requestAnimationFrame(loop);
    };
    this.cropAnimFrame = requestAnimationFrame(loop);
  }

  private updateCropSizeLabel(): void {
    const w = this.cropBox.x2 - this.cropBox.x1 + 1;
    const h = this.cropBox.y2 - this.cropBox.y1 + 1;
    const el = this.container.querySelector('#crop-size');
    if (el) el.textContent = `${w} x ${h} tiles`;
  }

  /** Determine which edge/corner of the crop box the mouse is near */
  private getCropEdgeAt(clientX: number, clientY: number): typeof this.cropDragEdge {
    const b = this.cropBox;
    const tl = this.camera.worldToScreen(b.x1 * Config.TILE_SIZE, b.y1 * Config.TILE_SIZE);
    const br = this.camera.worldToScreen((b.x2 + 1) * Config.TILE_SIZE, (b.y2 + 1) * Config.TILE_SIZE);

    const margin = 20; // px hit zone
    const nearLeft = Math.abs(clientX - tl.x) < margin;
    const nearRight = Math.abs(clientX - br.x) < margin;
    const nearTop = Math.abs(clientY - tl.y) < margin;
    const nearBottom = Math.abs(clientY - br.y) < margin;
    const inX = clientX > tl.x - margin && clientX < br.x + margin;
    const inY = clientY > tl.y - margin && clientY < br.y + margin;

    if (nearTop && nearLeft) return 'topLeft';
    if (nearTop && nearRight) return 'topRight';
    if (nearBottom && nearLeft) return 'bottomLeft';
    if (nearBottom && nearRight) return 'bottomRight';
    if (nearTop && inX) return 'top';
    if (nearBottom && inX) return 'bottom';
    if (nearLeft && inY) return 'left';
    if (nearRight && inY) return 'right';
    return null;
  }

  private updateCropEdge(tileX: number, tileY: number): void {
    const b = this.cropBox;
    const minSize = 10; // minimum crop size in tiles

    switch (this.cropDragEdge) {
      case 'top':
        b.y1 = Math.max(0, Math.min(tileY, b.y2 - minSize));
        break;
      case 'bottom':
        b.y2 = Math.min(this.tileMap.height - 1, Math.max(tileY, b.y1 + minSize));
        break;
      case 'left':
        b.x1 = Math.max(0, Math.min(tileX, b.x2 - minSize));
        break;
      case 'right':
        b.x2 = Math.min(this.tileMap.width - 1, Math.max(tileX, b.x1 + minSize));
        break;
      case 'topLeft':
        b.y1 = Math.max(0, Math.min(tileY, b.y2 - minSize));
        b.x1 = Math.max(0, Math.min(tileX, b.x2 - minSize));
        break;
      case 'topRight':
        b.y1 = Math.max(0, Math.min(tileY, b.y2 - minSize));
        b.x2 = Math.min(this.tileMap.width - 1, Math.max(tileX, b.x1 + minSize));
        break;
      case 'bottomLeft':
        b.y2 = Math.min(this.tileMap.height - 1, Math.max(tileY, b.y1 + minSize));
        b.x1 = Math.max(0, Math.min(tileX, b.x2 - minSize));
        break;
      case 'bottomRight':
        b.y2 = Math.min(this.tileMap.height - 1, Math.max(tileY, b.y1 + minSize));
        b.x2 = Math.min(this.tileMap.width - 1, Math.max(tileX, b.x1 + minSize));
        break;
    }
    this.updateCropSizeLabel();
  }

  private drawCropOverlay(): void {
    if (!this.cropOverlay) return;
    const ctx = this.cropOverlay.getContext('2d')!;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const b = this.cropBox;
    const tl = this.camera.worldToScreen(b.x1 * Config.TILE_SIZE, b.y1 * Config.TILE_SIZE);
    const br = this.camera.worldToScreen((b.x2 + 1) * Config.TILE_SIZE, (b.y2 + 1) * Config.TILE_SIZE);

    // Dim outside
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, tl.y);
    ctx.fillRect(0, br.y, w, h - br.y);
    ctx.fillRect(0, tl.y, tl.x, br.y - tl.y);
    ctx.fillRect(br.x, tl.y, w - br.x, br.y - tl.y);

    // White border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Corner handles
    const handleSize = 8;
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of [[tl.x, tl.y], [br.x, tl.y], [tl.x, br.y], [br.x, br.y]]) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }

    // Edge midpoint handles
    const mx = (tl.x + br.x) / 2;
    const my = (tl.y + br.y) / 2;
    for (const [hx, hy] of [[mx, tl.y], [mx, br.y], [tl.x, my], [br.x, my]]) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }

    // Size label
    const cropW = b.x2 - b.x1 + 1;
    const cropH = b.y2 - b.y1 + 1;
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${cropW} x ${cropH}`, tl.x + 4, tl.y - 8);
  }

  private clearCropOverlay(): void {
    if (!this.cropOverlay) return;
    const ctx = this.cropOverlay.getContext('2d')!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cropOverlay.width, this.cropOverlay.height);
    ctx.restore();
  }

  private applyCrop(): void {
    const { x1, y1, x2, y2 } = this.cropBox;
    const oldW = this.tileMap.width, oldH = this.tileMap.height;
    const newW = x2 - x1 + 1, newH = y2 - y1 + 1;

    console.log(`Crop: (${x1},${y1})-(${x2},${y2}) | ${oldW}x${oldH} → ${newW}x${newH}`);

    if (newW === oldW && newH === oldH) {
      console.log('Crop is full map size — no change needed');
      this.exitCropMode();
      return;
    }

    this.tileMap.crop(x1, y1, x2, y2);
    setMapSize(this.tileMap.width, this.tileMap.height);

    this.rivers.clear();
    this.history = [];
    this.onTerrainChanged();
    this.exitCropMode();
  }

  private paintAt(clientX: number, clientY: number): void {
    const world = this.camera.screenToWorld(clientX, clientY);
    const tileX = Math.floor(world.x / Config.TILE_SIZE);
    const tileY = Math.floor(world.y / Config.TILE_SIZE);
    this.applyBrush(tileX, tileY);
    this.onTerrainChanged();
  }

  private applyBrush(cx: number, cy: number): void {
    const brush = BRUSHES[this.activeBrush];
    const r = this.brushSize;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!this.tileMap.inBounds(x, y)) continue;

        const idx = this.tileMap.index(x, y);
        const oldTerrain = this.tileMap.terrain[idx];
        if (oldTerrain !== brush.terrain) {
          this.currentStroke?.tiles.push({ idx, oldTerrain, newTerrain: brush.terrain });
          this.tileMap.terrain[idx] = brush.terrain;
        }
      }
    }
  }

  private snapshotForUndo(): void {
    // Save entire terrain state so filter operations can be undone
    const entry: HistoryEntry = { tiles: [], rivers: [] };
    const size = this.tileMap.width * this.tileMap.height;
    for (let i = 0; i < size; i++) {
      entry.tiles.push({ idx: i, oldTerrain: this.tileMap.terrain[i], newTerrain: 0 });
    }
    // We'll fill newTerrain on undo by reading current state after the filter runs
    // Actually, simpler: store a full copy, and undo just restores it
    (entry as HistoryEntry & { fullSnapshot: Uint8Array }).fullSnapshot = new Uint8Array(this.tileMap.terrain);
    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  private undo(): void {
    const entry = this.history.pop();
    if (!entry) return;

    // Check if this is a full snapshot (from a filter operation)
    const snapshot = (entry as HistoryEntry & { fullSnapshot?: Uint8Array }).fullSnapshot;
    if (snapshot) {
      this.tileMap.terrain.set(snapshot);
    } else {
      for (const tile of entry.tiles) {
        this.tileMap.terrain[tile.idx] = tile.oldTerrain;
      }
      for (const river of entry.rivers) {
        if (river.added) {
          this.rivers.removeRiver(river.x, river.y);
        } else {
          this.rivers.addRiver(river.x, river.y);
        }
      }
    }
    this.onTerrainChanged();
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Brush selection: 1-7
      const num = parseInt(e.key);
      if (num >= 1 && num <= BRUSHES.length) {
        this.activeBrush = num - 1;
        this.updateUI();
        return;
      }

      // Brush size: [ and ]
      if (e.key === '[') {
        this.brushSize = Math.max(1, this.brushSize - 1);
        (this.container.querySelector('#brush-size') as HTMLInputElement).value = String(this.brushSize);
        this.brushSizeLabel.textContent = String(this.brushSize);
      }
      if (e.key === ']') {
        this.brushSize = Math.min(20, this.brushSize + 1);
        (this.container.querySelector('#brush-size') as HTMLInputElement).value = String(this.brushSize);
        this.brushSizeLabel.textContent = String(this.brushSize);
      }

      // Undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.undo();
      }

      // Save
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.saveMap();
      }
    });
  }

  saveMap(): void {
    const W = Config.MAP_WIDTH;
    const H = Config.MAP_HEIGHT;
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    for (let i = 0; i < W * H; i++) {
      const terrain = this.tileMap.terrain[i] as TerrainType;
      const hex = TerrainConfigs[terrain].color;
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);

      // Encode rivers as a distinct blue (only on land tiles)
      const tx = i % W;
      const ty = Math.floor(i / W);
      if (this.rivers.isRiver(tx, ty) && terrain !== TerrainType.WATER) {
        r = 0x2a; g = 0x50; b = 0x9a;
      }

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    canvas.convertToBlob({ type: 'image/png' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'swath-map.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  loadMap(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const W = Config.MAP_WIDTH;
        const H = Config.MAP_HEIGHT;
        const canvas = new OffscreenCanvas(W, H);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, W, H);
        const imageData = ctx.getImageData(0, 0, W, H);
        const pixels = imageData.data;

        // Clear rivers
        this.rivers.clear();

        for (let i = 0; i < W * H; i++) {
          const r = pixels[i * 4];
          const g = pixels[i * 4 + 1];
          const b = pixels[i * 4 + 2];

          const terrain = this.colorToTerrain(r, g, b);
          this.tileMap.terrain[i] = terrain;

          // Check for river color (exact match only, to avoid confusing with water #2d5a8e)
          if (r === 0x2a && g === 0x50 && b === 0x9a) {
            const tx = i % W;
            const ty = Math.floor(i / W);
            this.rivers.addRiver(tx, ty);
          }
        }

        this.history = [];
        this.onTerrainChanged();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  private colorToTerrain(r: number, g: number, b: number): TerrainType {
    // Find closest matching terrain color
    let bestMatch = TerrainType.WATER;
    let bestDist = Infinity;

    for (const [typeStr, config] of Object.entries(TerrainConfigs)) {
      const type = Number(typeStr) as TerrainType;
      const hex = config.color;
      const tr = parseInt(hex.slice(1, 3), 16);
      const tg = parseInt(hex.slice(3, 5), 16);
      const tb = parseInt(hex.slice(5, 7), 16);
      const dist = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = type;
      }
    }
    return bestMatch;
  }
}
