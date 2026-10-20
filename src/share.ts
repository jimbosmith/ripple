import type { GameState } from './types.ts';

export const SHARE_GAME_URL = 'https://jimbosmith.github.io/ripple/';
export const SHARE_DISPLAY_URL = 'jimbosmith.github.io/ripple';

export interface ShareSnapshot {
  score: number;
  hoops: number;
  cleanShots: number;
  maxMultiplier: number;
  isPersonalBest: boolean;
  label: string;
}

export function buildShareSnapshot(state: GameState): ShareSnapshot {
  const useCurrent = state.score > 0 || state.bestScore === 0;
  const score = useCurrent ? state.score : state.bestScore;
  const hoops = useCurrent ? state.hoopsCleared : state.bestHoops;
  const cleanShots = useCurrent ? state.telemetry.cleanShots : state.bestCleanShots;
  const maxMultiplier = useCurrent
    ? Math.max(state.multiplier, state.telemetry.maxMultiplier)
    : Math.max(1, state.bestMultiplier);
  const isPersonalBest = score > 0 && score >= state.bestScore;
  const label = useCurrent ? 'SCORE ACHIEVED' : 'PERSONAL BEST';

  return {
    score,
    hoops,
    cleanShots,
    maxMultiplier,
    isPersonalBest,
    label
  };
}

export function buildShareMessage(snap: ShareSnapshot): string {
  const cleanBadge = snap.cleanShots > 0 ? ` · ✨ ${snap.cleanShots} Clean` : '';
  const streakBadge = snap.maxMultiplier > 1 ? ` (×${snap.maxMultiplier} Streak)` : '';
  return (
    `🌊 RIPPLE — ${snap.score.toLocaleString()} pts\n` +
    `⭕ ${snap.hoops} Hoops${cleanBadge}${streakBadge}\n` +
    `Steer the floating puck by tapping the water around it:\n` +
    `${SHARE_GAME_URL}`
  );
}

/**
 * Renders a luxury, high-DPI social scorecard onto a <canvas> element.
 */
export function renderShareScoreCard(canvas: HTMLCanvasElement, state: GameState): ShareSnapshot {
  const snap = buildShareSnapshot(state);
  const ctx = canvas.getContext('2d');
  if (!ctx) return snap;

  const w = 680;
  const h = 380;
  const dpr = 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  // 1. Deep obsidian-sapphire studio background
  const bg = ctx.createRadialGradient(w * 0.76, h * 0.48, 12, w * 0.5, h * 0.5, w * 0.85);
  bg.addColorStop(0, '#10344b');
  bg.addColorStop(0.45, '#071a28');
  bg.addColorStop(0.85, '#040d15');
  bg.addColorStop(1, '#02060a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 2. Decorative luminous concentric water ripples & floating puck on the right side
  const artX = w * 0.77;
  const artY = h * 0.46;

  // Soft golden-aqua caustic bloom
  const bloom = ctx.createRadialGradient(artX, artY, 8, artX, artY, 170);
  bloom.addColorStop(0, 'rgba(76, 247, 216, 0.22)');
  bloom.addColorStop(0.55, 'rgba(102, 227, 255, 0.08)');
  bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(artX, artY, 170, 0, Math.PI * 2);
  ctx.fill();

  for (const [rad, alpha, width, isGold] of [
    [145, 0.12, 1.2, false],
    [110, 0.24, 1.8, false],
    [76, 0.55, 3.2, true],
    [46, 0.42, 1.6, false]
  ] as const) {
    ctx.beginPath();
    ctx.arc(artX, artY, rad, 0, Math.PI * 2);
    ctx.strokeStyle = isGold
      ? `rgba(255, 232, 138, ${alpha})`
      : `rgba(110, 238, 255, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // Glowing floating puck illustration at center of the rings
  const puckGrad = ctx.createRadialGradient(artX - 5, artY - 6, 2, artX, artY, 20);
  puckGrad.addColorStop(0, '#ffffff');
  puckGrad.addColorStop(0.55, '#dff2fc');
  puckGrad.addColorStop(1, '#396985');
  ctx.beginPath();
  ctx.arc(artX, artY, 20, 0, Math.PI * 2);
  ctx.fillStyle = puckGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(artX, artY, 19.2, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffe898';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(artX, artY, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = '#38ebd0';
  ctx.fill();

  // 3. Outer card chamfer border
  ctx.strokeStyle = 'rgba(130, 232, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // 4. Header brand lockup
  ctx.fillStyle = '#4cf7d8';
  ctx.font = '800 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('RIPPLE · HYDRO-IMPULSE WATER TOY', 38, 48);

  // 5. Score Achieved label & Personal Best badge
  ctx.fillStyle = '#92b8cc';
  ctx.font = '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(snap.label, 38, 86);

  if (snap.isPersonalBest && snap.score > 0) {
    ctx.fillStyle = 'rgba(255, 230, 128, 0.16)';
    ctx.beginPath();
    ctx.roundRect(162, 71, 124, 21, 99);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 230, 128, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffe888';
    ctx.font = '800 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('★ PERSONAL BEST', 174, 85);
  }

  // Giant glowing score number
  ctx.save();
  ctx.font = '800 68px "Outfit", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(76, 247, 216, 0.45)';
  ctx.shadowBlur = 22;
  ctx.fillText(snap.score.toLocaleString(), 36, 154);
  ctx.restore();

  // 6. Stat pills row (Hoops, Clean Shots, Max Multiplier)
  const stats = [
    { label: 'HOOPS PASSED', val: String(snap.hoops), accent: '#ffffff' },
    { label: 'CLEAN SHOTS', val: String(snap.cleanShots), accent: '#ffe680' },
    { label: 'PEAK STREAK', val: `×${snap.maxMultiplier}`, accent: '#4cf7d8' }
  ];

  stats.forEach((st, idx) => {
    const bx = 38 + idx * 136;
    const by = 182;
    const bw = 124;
    const bh = 66;

    ctx.fillStyle = 'rgba(12, 28, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 225, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#89b0c4';
    ctx.font = '700 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(st.label, bx + 14, by + 23);

    ctx.fillStyle = st.accent;
    ctx.font = '800 24px "Outfit", system-ui, sans-serif';
    ctx.fillText(st.val, bx + 14, by + 52);
  });

  // 7. Bottom Call-To-Action & Shareable Link Banner
  const footY = 286;
  ctx.fillStyle = 'rgba(10, 25, 38, 0.9)';
  ctx.beginPath();
  ctx.roundRect(38, footY, w - 76, 60, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(76, 247, 216, 0.36)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#b9e2f5';
  ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Steer the puck by tapping the water around it. Try to beat this run:', 56, footY + 25);

  ctx.fillStyle = '#4cf7d8';
  ctx.font = '800 16px "Outfit", system-ui, sans-serif';
  ctx.fillText(`🔗 ${SHARE_DISPLAY_URL}`, 56, footY + 47);

  ctx.restore();
  return snap;
}
