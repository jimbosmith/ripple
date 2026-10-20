import type { GameState, RippleConfig, Vec2 } from './types.ts';

export interface RenderOptions {
  reducedMotion: boolean;
  showDevOverlays: boolean;
  visualHapticPulse: number;
}

export class PoolRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 800;
  private height: number = 800;
  private dpr: number = 1;
  private centerX: number = 400;
  private centerY: number = 400;
  private scale: number = 1;
  private clockSec: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.width = Math.max(300, Math.floor(rect.width));
    this.height = Math.max(300, Math.floor(rect.height));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.centerX = this.width * 0.5;
    this.centerY = this.height * 0.5;

    // Fit poolRadius (320) + outer vessel bezel (44) comfortably inside the viewport
    const minDim = Math.min(this.width, this.height);
    this.scale = (minDim * 0.455) / 320;
  }

  /**
   * Converts client (screen) coordinates to logical pool coordinates centered at (0, 0).
   */
  public clientToPool(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return {
      x: (localX - this.centerX) / this.scale,
      y: (localY - this.centerY) / this.scale
    };
  }

  public render(state: GameState, config: RippleConfig, dt: number, opts: RenderOptions): void {
    if (!opts.reducedMotion) {
      this.clockSec += dt;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Studio desk backdrop
    this.drawDeskBackdrop(ctx, opts.visualHapticPulse);

    // Transform into logical pool coordinates centered at (centerX, centerY)
    ctx.translate(this.centerX, this.centerY);
    ctx.scale(this.scale, this.scale);

    // 2. Desktop water vessel exterior bezel & recessed shadow
    this.drawVesselBezel(ctx, config, opts.visualHapticPulse);

    // Clip to water surface interior for underwater caustics, wakes, and waves
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, config.poolRadius, 0, Math.PI * 2);
    ctx.clip();

    // 3. Deep water gradient & procedural floor caustics
    this.drawWaterDepthAndCaustics(ctx, config, opts.reducedMotion);

    // 4. Edge danger proximity glow along the pool rim
    this.drawEdgeProximityWarning(ctx, state, config);

    // 5. Next hoop submerged preview ring
    this.drawNextHoopPreview(ctx, state);

    // 6. Cleared hoop flash & expanding chime rings
    this.drawClearedHoopEffects(ctx, state);

    // 7. Current Illuminated Hoop & countdown ring
    this.drawCurrentHoop(ctx, state);

    // 8. Puck underwater shadow & bioluminescent wake ribbon
    this.drawPuckShadowAndWake(ctx, state);

    // 9. Active expanding circular ripple & commitment indicator
    this.drawActiveRipple(ctx, state, config);

    // 10. Blocked tap feedback (when ripple is already active or tapped on puck)
    this.drawGhostTaps(ctx, state, config);

    // 11. Water spray droplets & chime sparkles
    this.drawParticles(ctx, state);

    // 12. First-run / Hoop #0 gentle tap guide around the puck
    if (
      state.phase === 'playing' &&
      state.hoopsCleared === 0 &&
      !state.currentHoop.timerActive &&
      state.activeRipple === null
    ) {
      this.drawInitialTapGuide(ctx, state, config);
    }

    // 13. The Floating Puck (2.5D disc with tilt, buoyancy bob, and specular dome)
    this.drawFloatingPuck(ctx, state, config);

    // 14. Soft overhead studio light reflection across the water meniscus
    this.drawSurfaceReflections(ctx, config);

    ctx.restore(); // End water clip

    // 15. Inner meniscus highlight ring (lethal boundary)
    this.drawRimMeniscus(ctx, state, config);

    // 16. Floating callouts (CLEAN SHOT x2, CLOSE SAVE, etc.)
    this.drawCallouts(ctx, state);

    // 17. Developer telemetry overlay vectors
    if (opts.showDevOverlays) {
      this.drawDevOverlays(ctx, state, config);
    }

    ctx.restore();
  }

  private drawDeskBackdrop(ctx: CanvasRenderingContext2D, hapticPulse: number): void {
    const grad = ctx.createRadialGradient(
      this.centerX,
      this.centerY * 0.9,
      20,
      this.centerX,
      this.centerY,
      Math.max(this.width, this.height) * 0.75
    );
    const pulseBoost = Math.round(hapticPulse * 12);
    grad.addColorStop(0, `rgb(${14 + pulseBoost}, ${22 + pulseBoost}, ${32 + pulseBoost})`);
    grad.addColorStop(0.55, '#090e15');
    grad.addColorStop(1, '#04060a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawVesselBezel(
    ctx: CanvasRenderingContext2D,
    config: RippleConfig,
    hapticPulse: number
  ): void {
    const R = config.poolRadius;

    // Soft ambient desk drop-shadow beneath the water toy
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 12, R + 34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 45;
    ctx.fill();
    ctx.restore();

    // Brushed dark-anodized outer casing
    const outerGrad = ctx.createLinearGradient(-R - 30, -R - 30, R + 30, R + 30);
    outerGrad.addColorStop(0, '#2a3644');
    outerGrad.addColorStop(0.35, '#17202a');
    outerGrad.addColorStop(0.7, '#0d131a');
    outerGrad.addColorStop(1, '#1c2733');

    ctx.beginPath();
    ctx.arc(0, 0, R + 26, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // Subtle rim bevel catch-light
    ctx.beginPath();
    ctx.arc(0, 0, R + 25.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140, 220, 255, ${0.14 + hapticPulse * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner stepped dark ceramic wall
    const stepGrad = ctx.createLinearGradient(0, -R - 10, 0, R + 10);
    stepGrad.addColorStop(0, '#091017');
    stepGrad.addColorStop(1, '#182430');
    ctx.beginPath();
    ctx.arc(0, 0, R + 9, 0, Math.PI * 2);
    ctx.fillStyle = stepGrad;
    ctx.fill();
  }

  private drawWaterDepthAndCaustics(
    ctx: CanvasRenderingContext2D,
    config: RippleConfig,
    reducedMotion: boolean
  ): void {
    const R = config.poolRadius;

    // Deep obsidian- sapphire water gradient
    const waterGrad = ctx.createRadialGradient(-35, -45, 15, 0, 0, R * 1.05);
    waterGrad.addColorStop(0, '#0b2232');
    waterGrad.addColorStop(0.55, '#071723');
    waterGrad.addColorStop(0.88, '#040f18');
    waterGrad.addColorStop(1, '#02080e');

    ctx.fillStyle = waterGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // Subtle underwater caustic net on the pool floor
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const t = reducedMotion ? 1.5 : this.clockSec * 0.55;

    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 + t * (i % 2 === 0 ? 0.22 : -0.18);
      const orbit = 55 + i * 24;
      const cx = Math.cos(angle) * orbit;
      const cy = Math.sin(angle * 1.2) * orbit;
      const rad = 95 + Math.sin(t * 1.3 + i) * 18;

      const cGrad = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
      cGrad.addColorStop(0, 'rgba(32, 160, 210, 0.01)');
      cGrad.addColorStop(0.65, 'rgba(65, 215, 245, 0.045)');
      cGrad.addColorStop(0.88, 'rgba(110, 240, 255, 0.02)');
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Concentric subtle basin floor calibration rings
    ctx.strokeStyle = 'rgba(90, 195, 235, 0.035)';
    ctx.lineWidth = 1;
    for (const frac of [0.35, 0.68]) {
      ctx.beginPath();
      ctx.arc(0, 0, R * frac, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEdgeProximityWarning(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const puck = state.puck;
    const radialDist = Math.hypot(puck.x, puck.y);
    const clearance = config.poolRadius - puck.radius - radialDist;
    const warnZone = config.edgeDangerMargin * 1.35;

    if (clearance >= warnZone && state.failureReason !== 'edge_contact') {
      return;
    }

    const intensity =
      state.failureReason === 'edge_contact'
        ? 0.9
        : Math.max(0, Math.min(1, 1 - clearance / warnZone));

    const contactAngle = Math.atan2(puck.y, puck.x);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, config.poolRadius - 2, contactAngle - 0.65, contactAngle + 0.65);
    ctx.strokeStyle = `rgba(255, 92, 108, ${0.25 + intensity * 0.65})`;
    ctx.lineWidth = 4 + intensity * 4;
    ctx.shadowColor = 'rgba(255, 80, 95, 0.8)';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.restore();
  }

  private drawNextHoopPreview(ctx: CanvasRenderingContext2D, state: GameState): void {
    const next = state.nextHoopPreview;
    const cur = state.currentHoop;

    ctx.save();
    // Whisper-thin dashed flow connector from current hoop to next hoop location
    ctx.beginPath();
    ctx.setLineDash([4, 7]);
    ctx.moveTo(cur.x, cur.y);
    ctx.lineTo(next.x, next.y);
    ctx.strokeStyle = 'rgba(110, 220, 245, 0.11)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Submerged preview ring
    ctx.beginPath();
    ctx.arc(next.x, next.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(110, 225, 250, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(next.x, next.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(110, 225, 250, 0.25)';
    ctx.fill();
    ctx.restore();
  }

  private drawClearedHoopEffects(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const eff of state.clearedEffects) {
      const p = Math.min(1, eff.age / eff.duration);
      const easeOut = 1 - Math.pow(1 - p, 3);
      const alpha = Math.max(0, 1 - p);

      ctx.save();
      if (eff.isClean) {
        // Golden-cyan prismatic flash for Clean Shots
        const flashRad = eff.radius * (0.9 + easeOut * 0.75);
        const grad = ctx.createRadialGradient(eff.x, eff.y, 0, eff.x, eff.y, flashRad);
        grad.addColorStop(0, `rgba(255, 244, 180, ${alpha * 0.55})`);
        grad.addColorStop(0.5, `rgba(100, 255, 230, ${alpha * 0.32})`);
        grad.addColorStop(1, 'rgba(60, 220, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, flashRad, 0, Math.PI * 2);
        ctx.fill();

        // Double expanding crystal rings
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.cleanRadius + easeOut * 48, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 232, 130, ${alpha * 0.9})`;
        ctx.lineWidth = 2.8 * (1 - p * 0.5);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(eff.x, eff.y, eff.radius + easeOut * 28, 0, Math.PI * 2);
      ctx.strokeStyle = eff.isClean
        ? `rgba(110, 255, 235, ${alpha * 0.85})`
        : `rgba(90, 225, 255, ${alpha * 0.65})`;
      ctx.lineWidth = 2.2 * (1 - p * 0.5);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCurrentHoop(ctx: CanvasRenderingContext2D, state: GameState): void {
    const hoop = state.currentHoop;
    const frac = Math.max(0, Math.min(1, hoop.timer / Math.max(0.01, hoop.maxTimer)));
    const spawnScale = 0.78 + 0.22 * (1 - Math.pow(1 - hoop.spawnAnim, 3));
    const R = hoop.radius * spawnScale;
    const cleanR = hoop.cleanRadius * spawnScale;

    // Color transitions from luminous aqua-emerald to amber to urgent coral
    let ringColor = '#48f5d6';
    let glowColor = 'rgba(72, 245, 214, 0.55)';
    if (hoop.timer <= 1.8 && hoop.timerActive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.clockSec * 18);
      ringColor = pulse > 0.5 ? '#ff5c6c' : '#ff9466';
      glowColor = 'rgba(255, 92, 108, 0.65)';
    } else if (frac < 0.42) {
      ringColor = '#ffd15c';
      glowColor = 'rgba(255, 209, 92, 0.5)';
    }

    ctx.save();
    ctx.translate(hoop.x, hoop.y);

    // 1. Soft water-surface bloom underneath the illuminated hoop
    const bloom = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.45);
    bloom.addColorStop(0, 'rgba(72, 245, 214, 0.08)');
    bloom.addColorStop(0.65, glowColor.replace(/0\.\d+\)$/, '0.16)'));
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // 2. Dim background track of the hoop
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(130, 230, 250, 0.22)';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // 3. Illuminated countdown arc around the hoop perimeter
    const startAngle = -Math.PI * 0.5;
    const endAngle = startAngle + Math.PI * 2 * frac;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, startAngle, endAngle, false);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.restore();

    // 4. Inner Clean Shot bullseye ring ("pass through the centre of a hoop for a glassy chime")
    ctx.beginPath();
    ctx.arc(0, 0, cleanR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 236, 155, 0.48)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center pinpoint luminous jewel
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 242, 185, 0.82)';
    ctx.fill();

    // Subtle remaining seconds readout just below hoop when timer is active
    if (hoop.timerActive) {
      ctx.font = '600 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = hoop.timer <= 1.8 ? '#ff7a85' : 'rgba(180, 240, 255, 0.72)';
      ctx.fillText(`${hoop.timer.toFixed(1)}s`, 0, R + 15);
    }

    ctx.restore();
  }

  private drawPuckShadowAndWake(ctx: CanvasRenderingContext2D, state: GameState): void {
    const puck = state.puck;

    // 1. Bioluminescent wake ribbon behind the moving puck
    if (puck.wake.length > 1) {
      ctx.save();
      for (let i = 1; i < puck.wake.length; i++) {
        const a = puck.wake[i - 1];
        const b = puck.wake[i];
        const life = Math.max(0, 1 - b.age / b.maxAge);
        const width = Math.max(1.2, puck.radius * 0.75 * life);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle =
          b.cleanGlow > 0.2
            ? `rgba(130, 255, 225, ${life * 0.34})`
            : `rgba(95, 220, 255, ${life * 0.24})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Underwater floor shadow cast by the floating puck
    const shadowOffset = 9 + puck.bobZ * 2.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(puck.x + 4, puck.y + shadowOffset, puck.radius * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 4, 9, 0.58)';
    ctx.fill();
    ctx.restore();
  }

  private drawActiveRipple(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const ripple = state.activeRipple;
    if (!ripple) return;

    const progress = Math.min(1, ripple.age / ripple.duration);
    const fade = Math.pow(1 - progress, 0.75);
    const R = ripple.currentRadius;

    ctx.save();

    // 1. Refractive dark water trough slightly inside the wave crest
    if (R > 10) {
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, Math.max(2, R - 6), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(1, 10, 18, ${fade * 0.55})`;
      ctx.lineWidth = 7;
      ctx.stroke();
    }

    // 2. Primary expanding luminous wave crest (the physical pushing front)
    ctx.save();
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, R, 0, Math.PI * 2);
    ctx.strokeStyle = ripple.hasImpactedPuck
      ? `rgba(120, 238, 255, ${fade * 0.65})`
      : `rgba(135, 248, 255, ${fade * 0.95})`;
    ctx.lineWidth = ripple.hasImpactedPuck ? 2.6 : 3.6;
    ctx.shadowColor = 'rgba(95, 235, 255, 0.8)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();

    // 3. Secondary inner capillary trailing rings for authentic water toy look
    const inner1 = R * 0.72;
    if (inner1 > 8) {
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, inner1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(105, 225, 255, ${fade * 0.35})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    const inner2 = R * 0.44;
    if (inner2 > 6) {
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, inner2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(105, 225, 255, ${fade * 0.18})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // 4. Tap origin ~0.5s commitment cooldown indicator ring
    // Shows clearly when the single active ripple will finish and allow the next tap
    const remainFrac = Math.max(0, 1 - progress);
    ctx.beginPath();
    ctx.arc(
      ripple.x,
      ripple.y,
      8,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + Math.PI * 2 * remainFrac
    );
    ctx.strokeStyle = `rgba(160, 245, 255, ${0.28 + remainFrac * 0.45})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(190, 250, 255, ${fade * 0.8})`;
    ctx.fill();

    // 5. If the run just ended because the player tapped slightly too late, highlight the gap!
    if (state.phase === 'gameover' && !ripple.hasImpactedPuck) {
      const dx = state.puck.x - ripple.x;
      const dy = state.puck.y - ripple.y;
      const dist = Math.hypot(dx, dy);
      if (dist > R && dist <= config.poolRadius * 1.5) {
        const ux = dx / dist;
        const uy = dy / dist;
        ctx.beginPath();
        ctx.setLineDash([3, 4]);
        ctx.moveTo(ripple.x + ux * R, ripple.y + uy * R);
        ctx.lineTo(state.puck.x - ux * state.puck.radius, state.puck.y - uy * state.puck.radius);
        ctx.strokeStyle = 'rgba(255, 195, 110, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  private drawGhostTaps(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    for (const g of state.ghostTaps) {
      const p = Math.min(1, g.age / g.duration);
      const alpha = 1 - p;

      ctx.save();
      if (g.reason === 'on_puck') {
        // Show the exclusion ring around the puck reminding the player not to touch the puck itself
        ctx.beginPath();
        ctx.arc(state.puck.x, state.puck.y, config.puckTapExclusionRadius + p * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 180, 105, ${alpha * 0.85})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (g.reason === 'ripple_active') {
        // Subtle locked indicator at the tap site showing a wave is already active
        ctx.beginPath();
        ctx.arc(g.x, g.y, 7 + p * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 150, 120, ${alpha * 0.65})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const pt of state.particles) {
      const life = Math.max(0, 1 - pt.age / pt.maxAge);
      ctx.save();
      ctx.globalAlpha = pt.alpha * life;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius * (0.5 + 0.5 * life), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawInitialTapGuide(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const puck = state.puck;
    const pulse = 0.5 + 0.5 * Math.sin(this.clockSec * 4.2);
    const idealTapY = puck.y + 46;

    ctx.save();
    // Subtle exclusion boundary around puck
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, config.puckTapExclusionRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(130, 225, 250, 0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inviting pulsing target behind the puck showing where to tap first
    ctx.beginPath();
    ctx.arc(puck.x, idealTapY, 10 + pulse * 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(110, 245, 230, ${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(puck.x, idealTapY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(150, 255, 240, 0.85)';
    ctx.fill();

    ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(185, 242, 255, 0.82)';
    ctx.fillText('TAP BEHIND PUCK TO LAUNCH', puck.x, idealTapY + 26);
    ctx.restore();
  }

  private drawFloatingPuck(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const puck = state.puck;
    const R = puck.radius * (1 + puck.bobZ * 0.04);

    ctx.save();
    ctx.translate(puck.x, puck.y);

    // Subtle meniscus water ring clinging to the floating puck
    ctx.beginPath();
    ctx.arc(0, 0, R + 3.2, 0, Math.PI * 2);
    ctx.strokeStyle =
      state.multiplier > 1
        ? 'rgba(120, 255, 225, 0.48)'
        : 'rgba(115, 225, 255, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Puck outer chamfered body (warm ivory / frosted pearl glass + brass rim)
    const tiltOffsetX = puck.tiltX * 3.2;
    const tiltOffsetY = puck.tiltY * 3.2;
    const bodyGrad = ctx.createRadialGradient(
      -4 + tiltOffsetX,
      -5 + tiltOffsetY,
      2,
      0,
      0,
      R
    );
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.55, '#dcedf7');
    bodyGrad.addColorStop(0.85, '#8ab4cc');
    bodyGrad.addColorStop(1, '#3b647d');

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Crisp metallic-glass rim
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = state.multiplier > 1 ? '#ffe898' : '#b8ecff';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Inner recessed core indicator
    ctx.beginPath();
    ctx.arc(tiltOffsetX * 0.5, tiltOffsetY * 0.5, R * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = state.multiplier > 1 ? '#30d5c8' : '#1b4965';
    ctx.fill();

    // Specular studio dome reflection on top of the puck
    ctx.beginPath();
    ctx.ellipse(
      -3.5 + tiltOffsetX * 0.35,
      -4.2 + tiltOffsetY * 0.35,
      R * 0.38,
      R * 0.22,
      -0.45,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fill();

    ctx.restore();
  }

  private drawSurfaceReflections(ctx: CanvasRenderingContext2D, config: RippleConfig): void {
    const R = config.poolRadius;

    // Soft curved overhead studio lamp reflection on the upper-left water surface
    ctx.save();
    const reflGrad = ctx.createLinearGradient(-R * 0.7, -R * 0.75, 0, 0);
    reflGrad.addColorStop(0, 'rgba(180, 235, 255, 0.065)');
    reflGrad.addColorStop(0.5, 'rgba(140, 220, 255, 0.02)');
    reflGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.ellipse(-R * 0.22, -R * 0.28, R * 0.68, R * 0.38, -0.52, 0, Math.PI * 2);
    ctx.fillStyle = reflGrad;
    ctx.fill();
    ctx.restore();
  }

  private drawRimMeniscus(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const R = config.poolRadius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle =
      state.failureReason === 'edge_contact'
        ? 'rgba(255, 95, 110, 0.85)'
        : 'rgba(110, 215, 250, 0.28)';
    ctx.lineWidth = state.failureReason === 'edge_contact' ? 3 : 1.8;
    ctx.stroke();
    ctx.restore();
  }

  private drawCallouts(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const c of state.callouts) {
      const p = Math.min(1, c.age / c.duration);
      const alpha = Math.max(0, 1 - Math.pow(p, 1.6));
      const yOffset = -p * 22;

      ctx.save();
      ctx.translate(c.x, c.y + yOffset);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';

      if (c.kind === 'clean') {
        ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#ffe98a';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.text, 0, 0);
        if (c.subtext) {
          ctx.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.fillStyle = '#7affea';
          ctx.fillText(c.subtext, 0, 14);
        }
      } else if (c.kind === 'recovery') {
        ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#68ffd8';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.text, 0, 0);
        if (c.subtext) {
          ctx.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(c.subtext, 0, 14);
        }
      } else if (c.kind === 'info') {
        ctx.font = '700 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#ffcc88';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(c.text, 0, 0);
      } else {
        ctx.font = '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#aef2ff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(c.text, 0, 0);
      }

      ctx.restore();
    }
  }

  private drawDevOverlays(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const puck = state.puck;
    ctx.save();

    // Tap exclusion radius around puck
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, config.puckTapExclusionRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 160, 90, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();

    // Edge recovery danger margin
    ctx.beginPath();
    ctx.arc(0, 0, config.poolRadius - config.puckRadius - config.edgeDangerMargin, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 90, 110, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Puck velocity vector
    ctx.beginPath();
    ctx.moveTo(puck.x, puck.y);
    ctx.lineTo(puck.x + puck.vx * 0.35, puck.y + puck.vy * 0.35);
    ctx.strokeStyle = '#58ff8a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}
