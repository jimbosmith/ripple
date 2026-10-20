                                            
import { DEFAULT_CONFIG } from './config.js?v=3';

export class DevPanel {
          container             ;
          game            ;
          visible          = false;
         showOverlays          = false;

  constructor(container             , game            ) {
    this.container = container;
    this.game = game;
    this.buildDOM();
  }

         isVisible()          {
    return this.visible;
  }

         toggle(force          )       {
    this.visible = force !== undefined ? force : !this.visible;
    this.container.hidden = !this.visible;
    if (this.visible) {
      this.updateTelemetry();
    }
  }

          buildDOM()       {
    this.container.innerHTML = `
      <div class="dev-header">
        <strong>HYDRO-PHYSICS TELEMETRY</strong>
        <button type="button" class="dev-close-btn" id="dev-close">✕</button>
      </div>
      <div class="dev-section">
        <div class="dev-grid" id="dev-telemetry-grid"></div>
      </div>
      <div class="dev-section">
        <label class="dev-checkbox">
          <input type="checkbox" id="dev-overlays-toggle" />
          <span>Show Velocity & Exclusion Overlays</span>
        </label>
      </div>
      <div class="dev-section dev-sliders">
        <div class="slider-row">
          <label>Ripple Commitment (s): <span id="val-duration">${this.game.config.rippleDurationSec.toFixed(2)}</span></label>
          <input type="range" id="rng-duration" min="0.25" max="0.90" step="0.05" value="${this.game.config.rippleDurationSec}" />
        </div>
        <div class="slider-row">
          <label>Wave Speed (px/s): <span id="val-wavespeed">${this.game.config.waveSpeed}</span></label>
          <input type="range" id="rng-wavespeed" min="280" max="720" step="10" value="${this.game.config.waveSpeed}" />
        </div>
        <div class="slider-row">
          <label>Wave Push Impulse: <span id="val-impulse">${this.game.config.baseWaveImpulse}</span></label>
          <input type="range" id="rng-impulse" min="140" max="400" step="5" value="${this.game.config.baseWaveImpulse}" />
        </div>
        <div class="slider-row">
          <label>Water Drag: <span id="val-drag">${this.game.config.linearWaterDrag.toFixed(2)}</span></label>
          <input type="range" id="rng-drag" min="0.20" max="1.40" step="0.04" value="${this.game.config.linearWaterDrag}" />
        </div>
      </div>
      <div class="dev-footer">
        <button type="button" class="secondary-btn dev-btn-sm" id="dev-reset-cfg">Reset Defaults</button>
      </div>
    `;

    const closeBtn = this.container.querySelector('#dev-close');
    closeBtn?.addEventListener('click', () => this.toggle(false));

    const overlayToggle = this.container.querySelector('#dev-overlays-toggle')                           ;
    overlayToggle?.addEventListener('change', () => {
      this.showOverlays = Boolean(overlayToggle.checked);
    });

    const bindSlider = (
      id        ,
      valId        ,
      formatter                       ,
      apply                     
    ) => {
      const input = this.container.querySelector(`#${id}`)                           ;
      const label = this.container.querySelector(`#${valId}`);
      input?.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (label) label.textContent = formatter(v);
        apply(v);
      });
    };

    bindSlider(
      'rng-duration',
      'val-duration',
      (n) => n.toFixed(2),
      (n) => (this.game.config.rippleDurationSec = n)
    );
    bindSlider(
      'rng-wavespeed',
      'val-wavespeed',
      (n) => String(Math.round(n)),
      (n) => (this.game.config.waveSpeed = n)
    );
    bindSlider(
      'rng-impulse',
      'val-impulse',
      (n) => String(Math.round(n)),
      (n) => (this.game.config.baseWaveImpulse = n)
    );
    bindSlider(
      'rng-drag',
      'val-drag',
      (n) => n.toFixed(2),
      (n) => (this.game.config.linearWaterDrag = n)
    );

    const resetBtn = this.container.querySelector('#dev-reset-cfg');
    resetBtn?.addEventListener('click', () => {
      Object.assign(this.game.config, DEFAULT_CONFIG);
      this.buildDOM();
      this.updateTelemetry();
    });
  }

         updateTelemetry()       {
    if (!this.visible) return;
    const grid = this.container.querySelector('#dev-telemetry-grid');
    if (!grid) return;

    const s = this.game.state;
    const speed = Math.hypot(s.puck.vx, s.puck.vy);
    const rimDist = Math.max(
      0,
      Math.round(this.game.config.poolRadius - s.puck.radius - Math.hypot(s.puck.x, s.puck.y))
    );
    const rippleStatus = s.activeRipple
      ? `${Math.round((s.activeRipple.duration - s.activeRipple.age) * 1000)}ms lock`
      : 'READY';

    grid.innerHTML = `
      <div><span>Puck Speed:</span> <strong>${Math.round(speed)} px/s</strong></div>
      <div><span>Rim Clearance:</span> <strong>${rimDist} px</strong></div>
      <div><span>Ripple State:</span> <strong>${rippleStatus}</strong></div>
      <div><span>Wave Travel:</span> <strong>${s.telemetry.lastWaveTravelMs} ms</strong></div>
      <div><span>Hoop Radius:</span> <strong>${s.currentHoop.radius.toFixed(1)} px</strong></div>
      <div><span>Hoop Timer:</span> <strong>${s.currentHoop.timer.toFixed(2)} s</strong></div>
      <div><span>Clean Shots:</span> <strong>${s.telemetry.cleanShots} / ${s.hoopsCleared}</strong></div>
      <div><span>Edge Saves:</span> <strong>${s.telemetry.recoveries}</strong></div>
    `;
  }
}


//# sourceURL=devPanel.ts