import { GameState } from '../core/GameState';
import { GameLoop } from '../core/GameLoop';
import { EventBus } from '../core/EventBus';

export class TopBar {
  private el: HTMLDivElement;
  private goldEl!: HTMLSpanElement;
  private foodEl!: HTMLSpanElement;
  private manpowerEl!: HTMLSpanElement;
  private ironEl!: HTMLSpanElement;
  private woodEl!: HTMLSpanElement;
  private clothEl!: HTMLSpanElement;
  private stabilityEl!: HTMLSpanElement;
  private tickEl!: HTMLSpanElement;
  private speedButtons: HTMLButtonElement[] = [];

  constructor(private state: GameState, private loop: GameLoop) {
    this.el = document.createElement('div');
    this.el.id = 'top-bar';
    this.el.innerHTML = this.buildHTML();
    this.injectStyles();

    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) uiRoot.appendChild(this.el);

    this.goldEl = this.el.querySelector('#tb-gold')!;
    this.foodEl = this.el.querySelector('#tb-food')!;
    this.manpowerEl = this.el.querySelector('#tb-manpower')!;
    this.ironEl = this.el.querySelector('#tb-iron')!;
    this.woodEl = this.el.querySelector('#tb-wood')!;
    this.clothEl = this.el.querySelector('#tb-cloth')!;
    this.stabilityEl = this.el.querySelector('#tb-stability')!;
    this.tickEl = this.el.querySelector('#tb-tick')!;

    // Speed buttons
    this.el.querySelectorAll<HTMLButtonElement>('.tb-speed-btn').forEach((btn) => {
      this.speedButtons.push(btn);
      btn.addEventListener('click', () => {
        const speed = Number(btn.dataset.speed);
        this.loop.setSpeed(speed);
        this.updateSpeedButtons();
      });
    });

    this.updateSpeedButtons();

    EventBus.on('tick', () => this.refresh());
  }

  private buildHTML(): string {
    return `
      <div class="tb-section tb-resources">
        <span class="tb-item" title="Gold">💰 <span id="tb-gold">0</span></span>
        <span class="tb-item" title="Food">🌾 <span id="tb-food">0</span></span>
        <span class="tb-item" title="Manpower">👤 <span id="tb-manpower">0</span></span>
        <span class="tb-item" title="Iron">⛏️ <span id="tb-iron">0</span></span>
        <span class="tb-item" title="Wood">🪵 <span id="tb-wood">0</span></span>
        <span class="tb-item" title="Cloth">🧵 <span id="tb-cloth">0</span></span>
      </div>
      <div class="tb-section tb-center">
        <span class="tb-item" title="Stability">⚖️ <span id="tb-stability">70%</span></span>
        <span class="tb-sep">|</span>
        <span class="tb-item tb-tick">Tick <span id="tb-tick">0</span></span>
      </div>
      <div class="tb-section tb-speed">
        <button class="tb-speed-btn" data-speed="0">⏸</button>
        <button class="tb-speed-btn" data-speed="1">1×</button>
        <button class="tb-speed-btn" data-speed="2">2×</button>
        <button class="tb-speed-btn" data-speed="5">5×</button>
      </div>
    `;
  }

  private refresh(): void {
    const country = this.state.getPlayerCountry();
    if (!country) return;

    const r = country.resources;
    this.goldEl.textContent = Math.floor(r.gold).toString();
    this.foodEl.textContent = Math.floor(r.food).toString();
    this.manpowerEl.textContent = Math.floor(r.manpower).toString();
    this.ironEl.textContent = Math.floor(r.iron).toString();
    this.woodEl.textContent = Math.floor(r.wood).toString();
    this.clothEl.textContent = Math.floor(r.cloth).toString();

    const stab = Math.floor(country.stability);
    this.stabilityEl.textContent = `${stab}%`;
    this.stabilityEl.style.color =
      stab > 60 ? '#2ecc71' : stab > 30 ? '#f1c40f' : '#e74c3c';

    this.tickEl.textContent = this.state.currentTick.toString();
  }

  private updateSpeedButtons(): void {
    for (const btn of this.speedButtons) {
      const speed = Number(btn.dataset.speed);
      btn.classList.toggle('active', speed === this.state.speedMultiplier);
    }
  }

  private injectStyles(): void {
    if (document.getElementById('top-bar-styles')) return;
    const style = document.createElement('style');
    style.id = 'top-bar-styles';
    style.textContent = `
      #top-bar {
        position: fixed;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 6px 16px;
        background: rgba(26, 26, 46, 0.85);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #eee;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        pointer-events: auto;
        z-index: 100;
        user-select: none;
      }
      .tb-section { display: flex; align-items: center; gap: 10px; }
      .tb-item { white-space: nowrap; }
      .tb-sep { color: rgba(255,255,255,0.2); }
      .tb-tick { color: #888; }
      .tb-speed-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #ccc;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .tb-speed-btn:hover { background: rgba(255,255,255,0.15); }
      .tb-speed-btn.active {
        background: rgba(41, 128, 185, 0.6);
        border-color: rgba(41, 128, 185, 0.8);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }
}
