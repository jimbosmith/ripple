import type { GameState, RippleConfig, Vec2 } from './types.ts';

export interface RenderOptions {
  reducedMotion: boolean;
  showDevOverlays: boolean;
  visualHapticPulse: number;
}

interface AmbientMote {
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  size: number;
  tint: string;
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
  private ambientMotes: AmbientMote[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.initAmbientMotes();
    this.resize();
  }

  private initAmbientMotes(): void {
    this.ambientMotes = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const ang = (i * 2.399963) % (Math.PI * 2);
      const r = 30 + ((i * 47) % 260);
      this.ambientMotes.push({
        baseX: Math.cos(ang) * r,
        baseY: Math.sin(ang) * r,
        phase: i * 0.77,
        speed: 0.35 + (i % 5) * 0.12,
        size: 1.0 + (i % 3) * 0.55,
        tint: i % 3 === 0 ? 'rgba(255, 232, 148, 0.35)' : 'rgba(105, 240, 255, 0.32)'
      });
    }
  }

  public resize(): void {
    const rect =
      this.canvas.parentElement?.getBoundingClientRect() || this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.width = Math.max(280, Math.floor(rect.width));
    this.height = Math.max(280, Math.floor(rect.height));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Reserve space at the bottom so the status pill is never crowded or cut off on mobile
    const isMobile = this.width < 640 || this.height < 660;
    const bottomReserve = isMobile ? 54 : 46;
    const usableHeight = Math.max(220, this.height - bottomReserve);

    this.centerX = this.width * 0.5;
    this.centerY = usableHeight * 0.5;

    const minDim = Math.min(this.width, usableHeight);
    this.scale = (minDim * 0.445) / 320;
  }

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

    // 1. Studio desk backdrop with warm/cool architectural lighting
    this.drawDeskBackdrop(ctx, opts.visualHapticPulse);

    ctx.translate(this.centerX, this.centerY);
    ctx.scale(this.scale, this.scale);

    // 2. Precision-machined water vessel bezel & compass dial ticks
    this.drawVesselBezel(ctx, config, opts.visualHapticPulse);

    // Clip to water basin interior
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, config.poolRadius, 0, Math.PI * 2);
    ctx.clip();

    // 3. Deep abyssal water gradient, dual-layer floor caustics & floating motes
    this.drawWaterDepthAndCaustics(ctx, state, config, opts.reducedMotion);

    // 4. Recessed inner wall shadow for 3D basin depth
    this.drawBasinInnerWallShadow(ctx, config);

    // 5. Edge danger proximity glow along the pool rim
    this.drawEdgeProximityWarning(ctx, state, config);

    // 6. Next hoop submerged preview ring
    this.drawNextHoopPreview(ctx, state);

    // 7. Cleared hoop flash & expanding chime rings
    this.drawClearedHoopEffects(ctx, state);

    // 8. Current Illuminated Hoop & countdown ring
    this.drawCurrentHoop(ctx, state);

    // 9. Puck underwater shadow, caustic floor lens & bioluminescent wake ribbon
    this.drawPuckShadowAndWake(ctx, state);

    // 10. Active expanding circular ripple & commitment indicator
    this.drawActiveRipple(ctx, state, config);

    // 11. Blocked tap feedback
    this.drawGhostTaps(ctx, state, config);

    // 12. Water spray droplets & chime sparkles
    this.drawParticles(ctx, state);

    // 13. First-run / Hoop #0 gentle tap guide around the puck
    if (
      state.phase === 'playing' &&
      state.hoopsCleared === 0 &&
      !state.currentHoop.timerActive &&
      state.activeRipple === null
    ) {
      this.drawInitialTapGuide(ctx, state, config);
    }

    // 14. The Floating Puck (luxury pearl/gold 2.5D disc)
    this.drawFloatingPuck(ctx, state, config);

    // 15. Soft overhead studio light reflection across the water meniscus
    this.drawSurfaceReflections(ctx, config);

    ctx.restore(); // End water clip

    // 16. Inner meniscus highlight ring (lethal boundary)
    this.drawRimMeniscus(ctx, state, config);

    // 17. Floating callouts
    this.drawCallouts(ctx, state);

    // 18. Developer telemetry overlay vectors
    if (opts.showDevOverlays) {
      this.drawDevOverlays(ctx, state, config);
    }

    ctx.restore();
  }

  private drawDeskBackdrop(ctx: CanvasRenderingContext2D, hapticPulse: number): void {
    const maxR = Math.max(this.width, this.height) * 0.8;
    const grad = ctx.createRadialGradient(
      this.centerX - this.width * 0.08,
      this.centerY - this.height * 0.1,
      20,
      this.centerX,
      this.centerY,
      maxR
    );
    const boost = Math.round(hapticPulse * 14);
    grad.addColorStop(0, `rgb(${15 + boost}, ${26 + boost}, ${38 + boost})`);
    grad.addColorStop(0.45, '#09111a');
    grad.addColorStop(0.8, '#05080e');
    grad.addColorStop(1, '#020407');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle ambient turquoise-gold desk halo behind the vessel
    const haloGrad = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      80 * this.scale,
      this.centerX,
      this.centerY,
      395 * this.scale
    );
    haloGrad.addColorStop(0, 'rgba(60, 220, 235, 0.06)');
    haloGrad.addColorStop(0.75, 'rgba(40, 140, 190, 0.03)');
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawVesselBezel(
    ctx: CanvasRenderingContext2D,
    config: RippleConfig,
    hapticPulse: number
  ): void {
    const R = config.poolRadius;

    // Deep multi-layered ambient desk drop-shadow beneath the water toy
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 15, R + 36, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
    ctx.shadowBlur = 55;
    ctx.fill();
    ctx.restore();

    // Outer machined gunmetal & dark titanium casing
    const outerGrad = ctx.createLinearGradient(-R - 36, -R - 36, R + 36, R + 36);
    outerGrad.addColorStop(0, '#364658');
    outerGrad.addColorStop(0.28, '#1d2834');
    outerGrad.addColorStop(0.65, '#0c1218');
    outerGrad.addColorStop(1, '#233140');

    ctx.beginPath();
    ctx.arc(0, 0, R + 30, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // Precision chronograph/compass ticks around the anodized bezel
    ctx.save();
    for (let i = 0; i < 72; i++) {
      const ang = (i * Math.PI * 2) / 72;
      const isMajor = i % 6 === 0;
      const rInner = R + (isMajor ? 14.5 : 17);
      const rOuter = R + (isMajor ? 23.5 : 21.5);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * rInner, Math.sin(ang) * rInner);
      ctx.lineTo(Math.cos(ang) * rOuter, Math.sin(ang) * rOuter);
      ctx.strokeStyle = isMajor
        ? 'rgba(255, 224, 150, 0.34)'
        : 'rgba(140, 215, 245, 0.14)';
      ctx.lineWidth = isMajor ? 1.5 : 0.9;
      ctx.stroke();
    }
    ctx.restore();

    // Outer specular highlight ring
    ctx.beginPath();
    ctx.arc(0, 0, R + 29.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(165, 230, 255, ${0.18 + hapticPulse * 0.28})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner stepped obsidian-ceramic bezel + warm champagne-gold accent ring
    const stepGrad = ctx.createLinearGradient(-R, -R, R, R);
    stepGrad.addColorStop(0, '#070d14');
    stepGrad.addColorStop(0.5, '#0f1924');
    stepGrad.addColorStop(1, '#1e2d3d');
    ctx.beginPath();
    ctx.arc(0, 0, R + 11, 0, Math.PI * 2);
    ctx.fillStyle = stepGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, R + 11, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 218, 138, 0.26)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  private drawWaterDepthAndCaustics(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig,
    reducedMotion: boolean
  ): void {
    const R = config.poolRadius;

    // Rich abyssal teal-sapphire water depth
    const waterGrad = ctx.createRadialGradient(-45, -55, 18, 0, 0, R * 1.04);
    waterGrad.addColorStop(0, '#0f3146');
    waterGrad.addColorStop(0.38, '#092233');
    waterGrad.addColorStop(0.75, '#051420');
    waterGrad.addColorStop(1, '#02080f');

    ctx.fillStyle = waterGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // Subtle concentric sonar depth calibration rings on the basin floor
    ctx.save();
    ctx.strokeStyle = 'rgba(95, 215, 245, 0.042)';
    ctx.lineWidth = 1;
    for (const frac of [0.28, 0.56, 0.82]) {
      ctx.beginPath();
      ctx.arc(0, 0, R * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Subtle cross-axis floor hairlines
    ctx.beginPath();
    ctx.moveTo(-R * 0.85, 0);
    ctx.lineTo(R * 0.85, 0);
    ctx.moveTo(0, -R * 0.85);
    ctx.lineTo(0, R * 0.85);
    ctx.strokeStyle = 'rgba(95, 215, 245, 0.025)';
    ctx.stroke();
    ctx.restore();

    // Dual-layer procedural underwater caustic light ribbons
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const t = reducedMotion ? 1.5 : this.clockSec * 0.6;

    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7 + t * (i % 2 === 0 ? 0.24 : -0.19);
      const orbit = 48 + (i % 4) * 38;
      const cx = Math.cos(angle) * orbit;
      const cy = Math.sin(angle * 1.15) * orbit;
      const rad = 88 + Math.sin(t * 1.4 + i * 1.1) * 22;

      const cGrad = ctx.createRadialGradient(cx, cy, rad * 0.18, cx, cy, rad);
      cGrad.addColorStop(0, 'rgba(30, 175, 220, 0.005)');
      cGrad.addColorStop(0.62, 'rgba(72, 245, 224, 0.055)');
      cGrad.addColorStop(0.84, 'rgba(130, 245, 255, 0.03)');
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating bioluminescent deep-water micro-motes
    const parallaxX = -state.puck.x * 0.04;
    const parallaxY = -state.puck.y * 0.04;
    for (const m of this.ambientMotes) {
      const mx = m.baseX + parallaxX + Math.cos(t * m.speed + m.phase) * 9;
      const my = m.baseY + parallaxY + Math.sin(t * m.speed * 1.1 + m.phase) * 9;
      ctx.fillStyle = m.tint;
      ctx.beginPath();
      ctx.arc(mx, my, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawBasinInnerWallShadow(ctx: CanvasRenderingContext2D, config: RippleConfig): void {
    const R = config.poolRadius;
    const wallGrad = ctx.createRadialGradient(0, 8, R * 0.78, 0, 0, R);
    wallGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    wallGrad.addColorStop(0.82, 'rgba(0, 6, 14, 0.25)');
    wallGrad.addColorStop(1, 'rgba(0, 3, 8, 0.72)');

    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEdgeProximityWarning(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    config: RippleConfig
  ): void {
    const puck = state.puck;
    const radialDist = Math.hypot(puck.x, puck.y);
    const clearance = config.poolRadius - puck.radius - radialDist;
    const warnZone = config.edgeDangerMargin * 1.38;

    if (clearance >= warnZone && state.failureReason !== 'edge_contact') {
      return;
    }

    const intensity =
      state.failureReason === 'edge_contact'
        ? 0.95
        : Math.max(0, Math.min(1, 1 - clearance / warnZone));

    const contactAngle = Math.atan2(puck.y, puck.x);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, config.poolRadius - 2.5, contactAngle - 0.7, contactAngle + 0.7);
    ctx.strokeStyle = `rgba(255, 92, 108, ${0.28 + intensity * 0.68})`;
    ctx.lineWidth = 4.5 + intensity * 4.5;
    ctx.shadowColor = 'rgba(255, 80, 95, 0.85)';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  private drawNextHoopPreview(ctx: CanvasRenderingContext2D, state: GameState): void {
    const next = state.nextHoopPreview;
    const cur = state.currentHoop;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 7]);
    ctx.moveTo(cur.x, cur.y);
    ctx.lineTo(next.x, next.y);
    ctx.strokeStyle = 'rgba(120, 232, 255, 0.13)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(next.x, next.y, 15, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120, 235, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(next.x, next.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(150, 245, 255, 0.35)';
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
        const flashRad = eff.radius * (0.95 + easeOut * 0.85);
        const grad = ctx.createRadialGradient(eff.x, eff.y, 0, eff.x, eff.y, flashRad);
        grad.addColorStop(0, `rgba(255, 246, 190, ${alpha * 0.65})`);
        grad.addColorStop(0.48, `rgba(92, 255, 230, ${alpha * 0.36})`);
        grad.addColorStop(1, 'rgba(60, 220, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, flashRad, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.cleanRadius + easeOut * 54, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 232, 130, ${alpha * 0.92})`;
        ctx.lineWidth = 3.0 * (1 - p * 0.5);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(eff.x, eff.y, eff.radius + easeOut * 32, 0, Math.PI * 2);
      ctx.strokeStyle = eff.isClean
        ? `rgba(110, 255, 235, ${alpha * 0.88})`
        : `rgba(95, 230, 255, ${alpha * 0.68})`;
      ctx.lineWidth = 2.4 * (1 - p * 0.5);
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

    let ringColor = '#4cf7d8';
    let secondaryColor = '#66e3ff';
    let glowColor = 'rgba(76, 247, 216, 0.62)';
    if (hoop.timer <= 1.8 && hoop.timerActive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.clockSec * 18);
      ringColor = pulse > 0.5 ? '#ff5c6c' : '#ff9868';
      secondaryColor = '#ff7582';
      glowColor = 'rgba(255, 92, 108, 0.7)';
    } else if (frac < 0.42) {
      ringColor = '#ffd460';
      secondaryColor = '#ffae52';
      glowColor = 'rgba(255, 212, 96, 0.55)';
    }

    ctx.save();
    ctx.translate(hoop.x, hoop.y);

    // 1. Multi-layer submerged fiber-optic water bloom
    const bloom = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R * 1.55);
    bloom.addColorStop(0, 'rgba(255, 240, 175, 0.08)');
    bloom.addColorStop(0.55, glowColor.replace(/0\.\d+\)$/, '0.20)'));
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.55, 0, Math.PI * 2);
    ctx.fill();

    // 2. Submerged glass ring housing track
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(135, 232, 255, 0.22)';
    ctx.lineWidth = 5.2;
    ctx.stroke();

    // 3. Illuminated countdown arc with gradient & glowing spark tip
    const startAngle = -Math.PI * 0.5;
    const endAngle = startAngle + Math.PI * 2 * frac;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, startAngle, endAngle, false);
    const arcGrad = ctx.createLinearGradient(-R, -R, R, R);
    arcGrad.addColorStop(0, ringColor);
    arcGrad.addColorStop(1, secondaryColor);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 5.0;
    ctx.lineCap = 'round';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Specular white-hot core filament inside the countdown arc
    ctx.beginPath();
    ctx.arc(0, 0, R, startAngle, endAngle, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Bright spark jewel riding the leading edge of the countdown timer
    if (frac > 0.02) {
      const tipX = Math.cos(endAngle) * R;
      const tipY = Math.sin(endAngle) * R;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 12;
      ctx.fill();
    }
    ctx.restore();

    // 4. Inner Clean Shot bullseye reticle (rotating golden-crystal ring)
    ctx.save();
    ctx.rotate(this.clockSec * 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, cleanR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 236, 155, 0.58)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4 delicate cardinal diamond ticks on the clean-shot ring
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const tx = Math.cos(a) * cleanR;
      const ty = Math.sin(a) * cleanR;
      ctx.beginPath();
      ctx.arc(tx, ty, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 240, 175, 0.85)';
      ctx.fill();
    }
    ctx.restore();

    // Center crystal jewel
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff5c0';
    ctx.shadowColor = 'rgba(255, 235, 140, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fill();

    // Remaining seconds readout
    if (hoop.timerActive) {
      ctx.font = '700 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = hoop.timer <= 1.8 ? '#ff828c' : 'rgba(195, 245, 255, 0.8)';
      ctx.fillText(`${hoop.timer.toFixed(1)}s`, 0, R + 16);
    }

    ctx.restore();
  }

  private drawPuckShadowAndWake(ctx: CanvasRenderingContext2D, state: GameState): void {
    const puck = state.puck;

    // 1. Dual-rail bioluminescent wake ribbon behind the moving puck
    if (puck.wake.length > 1) {
      ctx.save();
      for (let i = 1; i < puck.wake.length; i++) {
        const a = puck.wake[i - 1];
        const b = puck.wake[i];
        const life = Math.max(0, 1 - b.age / b.maxAge);
        const width = Math.max(1.5, puck.radius * 0.88 * life);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle =
          b.cleanGlow > 0.2
            ? `rgba(255, 232, 140, ${life * 0.28})`
            : `rgba(85, 230, 255, ${life * 0.26})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright center wake filament
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle =
          b.cleanGlow > 0.2
            ? `rgba(140, 255, 235, ${life * 0.42})`
            : `rgba(180, 250, 255, ${life * 0.32})`;
        ctx.lineWidth = width * 0.35;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Underwater floor shadow + refractive caustic halo cast by the floating puck
    const shadowOffset = 9.5 + puck.bobZ * 2.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(puck.x + 4.5, puck.y + shadowOffset, puck.radius * 1.14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 4, 10, 0.62)';
    ctx.fill();

    // Subtle caustic lens ring around the floor shadow
    ctx.beginPath();
    ctx.arc(puck.x + 4.5, puck.y + shadowOffset, puck.radius * 1.24, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(95, 235, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
    const fade = Math.pow(1 - progress, 0.72);
    const R = ripple.currentRadius;
    const isPowerWave = ripple.isCloseHardHit;

    ctx.save();

    // 1. Refractive dark water trough inside the wave crest
    if (R > 10) {
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, Math.max(2, R - 6.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(1, 9, 17, ${fade * 0.6})`;
      ctx.lineWidth = 8;
      ctx.stroke();
    }

    // 2. Outer chromatic/golden lensing halo (stronger on close-range power taps!)
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, R + 3.2, 0, Math.PI * 2);
    ctx.strokeStyle = isPowerWave
      ? `rgba(255, 226, 130, ${fade * 0.55})`
      : `rgba(90, 245, 220, ${fade * 0.32})`;
    ctx.lineWidth = isPowerWave ? 2.6 : 1.8;
    ctx.stroke();

    // 3. Primary expanding luminous wave crest
    ctx.save();
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, R, 0, Math.PI * 2);
    ctx.strokeStyle = ripple.hasImpactedPuck
      ? `rgba(125, 240, 255, ${fade * 0.72})`
      : isPowerWave
        ? `rgba(215, 255, 255, ${fade * 0.98})`
        : `rgba(145, 250, 255, ${fade * 0.96})`;
    ctx.lineWidth = ripple.hasImpactedPuck ? 2.8 : isPowerWave ? 4.4 : 3.8;
    ctx.shadowColor = isPowerWave ? 'rgba(255, 232, 140, 0.9)' : 'rgba(95, 240, 255, 0.85)';
    ctx.shadowBlur = isPowerWave ? 18 : 15;
    ctx.stroke();
    ctx.restore();

    // 4. Secondary inner capillary trailing rings
    for (const [frac, alphaScale, width] of [
      [0.74, 0.38, 1.7],
      [0.48, 0.22, 1.2],
      [0.24, 0.12, 0.9]
    ]) {
      const innerR = R * frac;
      if (innerR > 6) {
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, innerR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(115, 232, 255, ${fade * alphaScale})`;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }

    // 5. Tap origin ~0.5s commitment cooldown dial
    const remainFrac = Math.max(0, 1 - progress);
    ctx.beginPath();
    ctx.arc(
      ripple.x,
      ripple.y,
      8.5,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + Math.PI * 2 * remainFrac
    );
    ctx.strokeStyle = isPowerWave
      ? `rgba(255, 230, 140, ${0.35 + remainFrac * 0.55})`
      : `rgba(165, 248, 255, ${0.3 + remainFrac * 0.48})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 252, 255, ${fade * 0.85})`;
    ctx.fill();

    // 6. Diagnostic gap line on gameover if wave was still traveling toward puck
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
        ctx.strokeStyle = 'rgba(255, 200, 115, 0.85)';
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
        ctx.beginPath();
        ctx.arc(state.puck.x, state.puck.y, config.puckTapExclusionRadius + p * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 185, 110, ${alpha * 0.88})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (g.reason === 'ripple_active') {
        ctx.beginPath();
        ctx.arc(g.x, g.y, 7 + p * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 155, 125, ${alpha * 0.68})`;
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
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 6;
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
    const idealTapY = puck.y + 44;

    ctx.save();
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, config.puckTapExclusionRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(135, 230, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(puck.x, idealTapY, 10 + pulse * 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(110, 248, 232, ${0.38 + pulse * 0.38})`;
    ctx.lineWidth = 1.9;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(puck.x, idealTapY, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 242, 180, 0.9)';
    ctx.fill();

    ctx.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(195, 245, 255, 0.86)';
    ctx.fillText('TAP CLOSE BEHIND PUCK TO LAUNCH', puck.x, idealTapY + 26);
    ctx.restore();
  }

  private drawFloatingPuck(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    _config: RippleConfig
  ): void {
    const puck = state.puck;
    const R = puck.radius * (1 + puck.bobZ * 0.045);
    const hitGlow = Math.min(1, puck.lastHitIntensity);

    ctx.save();
    ctx.translate(puck.x, puck.y);

    // 1. Luminous meniscus surface tension ring clinging to the puck
    ctx.beginPath();
    ctx.arc(0, 0, R + 3.6 + hitGlow * 2.0, 0, Math.PI * 2);
    ctx.strokeStyle =
      hitGlow > 0.35
        ? `rgba(255, 235, 145, ${0.45 + hitGlow * 0.4})`
        : state.multiplier > 1
          ? 'rgba(115, 255, 228, 0.52)'
          : 'rgba(120, 230, 255, 0.38)';
    ctx.lineWidth = 2.0 + hitGlow * 1.2;
    ctx.stroke();

    // 2. Luxury pearl-alabaster & brushed-champagne floating disc body
    const tiltOffsetX = puck.tiltX * 3.4;
    const tiltOffsetY = puck.tiltY * 3.4;
    const bodyGrad = ctx.createRadialGradient(
      -4 + tiltOffsetX,
      -5 + tiltOffsetY,
      2,
      0,
      0,
      R
    );
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.52, '#e6f4fc');
    bodyGrad.addColorStop(0.82, '#92bed6');
    bodyGrad.addColorStop(1, '#325a73');

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 3. Precision chamfered metallic rim (shifts to warm gold with multiplier or close power hit)
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.8, 0, Math.PI * 2);
    ctx.strokeStyle =
      state.multiplier > 1 || hitGlow > 0.4 ? '#ffe694' : '#bcefff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 4. Inner recessed jewel core
    const coreR = R * 0.44;
    const coreGrad = ctx.createRadialGradient(
      tiltOffsetX * 0.4,
      tiltOffsetY * 0.4,
      0.5,
      tiltOffsetX * 0.5,
      tiltOffsetY * 0.5,
      coreR
    );
    if (state.multiplier > 1) {
      coreGrad.addColorStop(0, '#fff6b8');
      coreGrad.addColorStop(0.6, '#3ee8d4');
      coreGrad.addColorStop(1, '#145266');
    } else {
      coreGrad.addColorStop(0, '#78ecff');
      coreGrad.addColorStop(0.65, '#1d5b7d');
      coreGrad.addColorStop(1, '#0d2e42');
    }
    ctx.beginPath();
    ctx.arc(tiltOffsetX * 0.5, tiltOffsetY * 0.5, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // 5. Crisp studio softbox dome reflection on top of the puck
    ctx.beginPath();
    ctx.ellipse(
      -3.6 + tiltOffsetX * 0.35,
      -4.4 + tiltOffsetY * 0.35,
      R * 0.4,
      R * 0.22,
      -0.45,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.84)';
    ctx.fill();

    ctx.restore();
  }

  private drawSurfaceReflections(ctx: CanvasRenderingContext2D, config: RippleConfig): void {
    const R = config.poolRadius;

    ctx.save();
    // Upper-left overhead softbox reflection
    const reflGrad = ctx.createLinearGradient(-R * 0.72, -R * 0.75, 0, 0);
    reflGrad.addColorStop(0, 'rgba(190, 240, 255, 0.075)');
    reflGrad.addColorStop(0.5, 'rgba(140, 225, 255, 0.022)');
    reflGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.ellipse(-R * 0.22, -R * 0.28, R * 0.68, R * 0.38, -0.52, 0, Math.PI * 2);
    ctx.fillStyle = reflGrad;
    ctx.fill();

    // Subtle lower-right warm rim bounce reflection
    const warmGrad = ctx.createRadialGradient(R * 0.55, R * 0.55, 10, R * 0.45, R * 0.45, R * 0.6);
    warmGrad.addColorStop(0, 'rgba(255, 220, 145, 0.035)');
    warmGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = warmGrad;
    ctx.beginPath();
    ctx.arc(R * 0.45, R * 0.45, R * 0.6, 0, Math.PI * 2);
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
        ? 'rgba(255, 95, 110, 0.9)'
        : 'rgba(120, 225, 255, 0.34)';
    ctx.lineWidth = state.failureReason === 'edge_contact' ? 3.2 : 1.9;
    ctx.stroke();
    ctx.restore();
  }

  private drawCallouts(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const c of state.callouts) {
      const p = Math.min(1, c.age / c.duration);
      const alpha = Math.max(0, 1 - Math.pow(p, 1.6));
      const yOffset = -p * 24;

      ctx.save();
      ctx.translate(c.x, c.y + yOffset);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';

      if (c.kind === 'clean') {
        ctx.font = '800 13.5px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#ffeb90';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.text, 0, 0);
        if (c.subtext) {
          ctx.font = '700 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.fillStyle = '#7affea';
          ctx.fillText(c.subtext, 0, 14);
        }
      } else if (c.kind === 'recovery') {
        ctx.font = '800 13.5px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#68ffd8';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.text, 0, 0);
        if (c.subtext) {
          ctx.font = '700 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(c.subtext, 0, 14);
        }
      } else if (c.kind === 'info') {
        ctx.font = '700 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#ffd08f';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(c.text, 0, 0);
      } else {
        ctx.font = '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#b4f4ff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
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
    ctx.strokeStyle = 'rgba(255, 160, 90, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();

    // Close-tap power boost radius around puck
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, config.closeTapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 230, 120, 0.35)';
    ctx.lineWidth = 1;
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
