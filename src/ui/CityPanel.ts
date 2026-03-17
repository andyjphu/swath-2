import { GameState } from '../core/GameState';
import { City, CityTier } from '../entities/City';
import { BuildingType, BuildingConfigs } from '../entities/Building';
import { TaxRate } from '../entities/Country';
import { SimBridge } from '../workers/SimBridge';
import { EventBus } from '../core/EventBus';

export class CityPanel {
  private el: HTMLDivElement;
  private currentCity: City | null = null;
  private visible = false;

  constructor(private state: GameState, private simBridge: SimBridge) {
    this.el = document.createElement('div');
    this.el.id = 'city-panel';
    this.el.style.display = 'none';
    this.injectStyles();

    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) uiRoot.appendChild(this.el);

    EventBus.on<{ cityId: number }>('city-clicked', (data) => {
      const city = this.state.cities.get(data.cityId);
      if (!city) return;
      // Only open for player cities
      if (city.countryId !== this.state.playerId) return;
      this.open(city);
    });

    EventBus.on('tick', () => {
      if (this.visible && this.currentCity) this.refresh();
    });

    EventBus.on('build-result', (data: { success: boolean; error?: string }) => {
      if (this.visible && this.currentCity) {
        if (!data.success && data.error) {
          // Brief flash of error
          console.warn('Build failed:', data.error);
        }
        this.refresh();
      }
    });
  }

  private open(city: City): void {
    this.currentCity = city;
    this.visible = true;
    this.el.style.display = 'block';
    this.refresh();
  }

  close(): void {
    this.currentCity = null;
    this.visible = false;
    this.el.style.display = 'none';
  }

  private refresh(): void {
    const city = this.currentCity;
    if (!city) return;
    const country = this.state.getPlayerCountry();
    if (!country) return;

    const tierName = city.tier === CityTier.VILLAGE ? 'Village' :
      city.tier === CityTier.TOWN ? 'Town' : 'Metropolis';
    const popCap = city.getPopulationCap();

    let buildingsHTML = '';
    if (city.buildings.length === 0) {
      buildingsHTML = '<div class="cp-empty">No buildings</div>';
    } else {
      for (const b of city.buildings) {
        const config = BuildingConfigs[b.type];
        buildingsHTML += `<div class="cp-building">${config.name} <span class="cp-effect">${config.effects}</span></div>`;
      }
    }

    let buildMenuHTML = '';
    for (const typeStr of Object.keys(BuildingConfigs)) {
      const type = Number(typeStr) as BuildingType;
      const config = BuildingConfigs[type];
      const costParts = [`${config.cost.gold}g`];
      if (config.cost.wood) costParts.push(`${config.cost.wood}w`);
      if (config.cost.iron) costParts.push(`${config.cost.iron}i`);

      const canAfford = country.resources.gold >= config.cost.gold &&
        (!config.cost.wood || country.resources.wood >= config.cost.wood) &&
        (!config.cost.iron || country.resources.iron >= config.cost.iron);

      buildMenuHTML += `
        <button class="cp-build-btn" data-type="${type}" ${canAfford ? '' : 'disabled'}>
          ${config.name} <span class="cp-cost">(${costParts.join(', ')})</span>
        </button>`;
    }

    const taxRates: TaxRate[] = ['low', 'normal', 'exorbitant'];

    this.el.innerHTML = `
      <div class="cp-header">
        <div>
          <span class="cp-name">${city.name}</span>
          <span class="cp-tier">${tierName}</span>
        </div>
        <button class="cp-close">✕</button>
      </div>
      <div class="cp-body">
        <div class="cp-stat">Population: ${Math.floor(city.population)} / ${popCap}</div>
        <div class="cp-stat">Tiles: ${city.urbanTiles.size} urban, ${city.farmTiles.size} farm</div>

        <div class="cp-section-title">Tax Rate</div>
        <div class="cp-tax-row">
          ${taxRates.map(rate => `
            <button class="cp-tax-btn ${country.taxRate === rate ? 'active' : ''}" data-rate="${rate}">
              ${rate.charAt(0).toUpperCase() + rate.slice(1)}
            </button>
          `).join('')}
        </div>

        <div class="cp-section-title">Buildings</div>
        ${buildingsHTML}

        <div class="cp-section-title">Build</div>
        <div class="cp-build-menu">${buildMenuHTML}</div>
      </div>
    `;

    // Wire events
    this.el.querySelector('.cp-close')!.addEventListener('click', () => this.close());

    this.el.querySelectorAll<HTMLButtonElement>('.cp-tax-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = btn.dataset.rate as TaxRate;
        this.simBridge.sendSetTax(country.id, rate);
        this.refresh();
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.cp-build-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = Number(btn.dataset.type) as BuildingType;
        this.simBridge.sendBuild(city.id, type);
      });
    });
  }

  private injectStyles(): void {
    if (document.getElementById('city-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'city-panel-styles';
    style.textContent = `
      #city-panel {
        position: fixed;
        top: 60px;
        right: 12px;
        width: 260px;
        background: rgba(26, 26, 46, 0.9);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #eee;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        pointer-events: auto;
        z-index: 99;
        user-select: none;
        max-height: calc(100vh - 80px);
        overflow-y: auto;
      }
      .cp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px 8px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .cp-name { font-size: 15px; font-weight: 600; }
      .cp-tier {
        font-size: 11px;
        background: rgba(255,255,255,0.1);
        padding: 1px 6px;
        border-radius: 3px;
        margin-left: 6px;
      }
      .cp-close {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 16px;
        padding: 0 4px;
      }
      .cp-close:hover { color: #fff; }
      .cp-body { padding: 8px 12px 12px; }
      .cp-stat { margin-bottom: 4px; color: #bbb; }
      .cp-section-title {
        font-size: 11px;
        text-transform: uppercase;
        color: #888;
        margin-top: 12px;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }
      .cp-building {
        padding: 4px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .cp-effect { color: #888; font-size: 11px; }
      .cp-empty { color: #666; font-style: italic; }
      .cp-tax-row { display: flex; gap: 4px; }
      .cp-tax-btn {
        flex: 1;
        padding: 4px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .cp-tax-btn:hover { background: rgba(255,255,255,0.15); }
      .cp-tax-btn.active {
        background: rgba(41, 128, 185, 0.6);
        border-color: rgba(41, 128, 185, 0.8);
        color: #fff;
      }
      .cp-build-menu { display: flex; flex-direction: column; gap: 4px; }
      .cp-build-btn {
        padding: 6px 8px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        text-align: left;
      }
      .cp-build-btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
      .cp-build-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .cp-cost { color: #f1c40f; }
    `;
    document.head.appendChild(style);
  }
}
