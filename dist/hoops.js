                                                                 
import { SeededRNG } from './rng.js?v=3';

/**
 * Computes the outer hoop radius for a given 0-based hoop index.
 * Starts large (initialHoopRadius) and smoothly tightens toward minHoopRadius.
 */
export function computeHoopRadius(hoopIndex        , config              )         {
  const k = Math.max(0, hoopIndex);
  const span = config.initialHoopRadius - config.minHoopRadius;
  const radius = config.minHoopRadius + span * Math.exp(-config.hoopRadiusTightenRate * k);
  return Number(radius.toFixed(2));
}

/**
 * Computes the countdown duration (seconds) for a given 0-based hoop index and travel distance.
 * Gradually shortens as hoopIndex increases while accounting for cross-pool travel distance.
 */
export function computeHoopCountdown(
  hoopIndex        ,
  distanceFromPuck        ,
  config              
)         {
  const k = Math.max(0, hoopIndex);
  const span = config.initialHoopCountdownSec - config.minHoopCountdownSec;
  const baseCountdown = config.minHoopCountdownSec + span * Math.exp(-config.countdownTightenRate * k);
  // Subtle distance fairness adjustment so cross-pool spawns remain fair without breaking monotonic tightening
  const normalizedDist = Math.max(0, Math.min(1, (distanceFromPuck - 140) / 320));
  const distAllowance = normalizedDist * 0.45 * Math.exp(-0.03 * k);
  return Number((baseCountdown + distAllowance).toFixed(2));
}

/**
 * Selects the next hoop coordinate inside the pool basin so it:
 * 1. Leaves comfortable clearance from the pool's lethal rim.
 * 2. Appears genuinely "elsewhere" from the previous hoop and current puck position.
 * 3. Favors sweeping flow angles relative to the puck's velocity when moving.
 */
export function pickNextHoopPosition(
  hoopIndex        ,
  fromPos      ,
  puckVel      ,
  rng           ,
  config              
)       {
  if (hoopIndex === 0) {
    // First hoop sits at an inviting position in the upper-center pool
    return { x: 0, y: -96 };
  }

  const targetRadius = computeHoopRadius(hoopIndex, config);
  const rimClearance = targetRadius + config.puckRadius + 38;
  const maxRadialDist = Math.max(80, config.poolRadius - rimClearance);
  const minSeparation = Math.min(145, maxRadialDist * 1.05);

  const speed = Math.hypot(puckVel.x, puckVel.y);
  const hasVelocityDir = speed > 22;
  const velDirX = hasVelocityDir ? puckVel.x / speed : 0;
  const velDirY = hasVelocityDir ? puckVel.y / speed : -1;

  let bestCandidate       = { x: 0, y: 0 };
  let bestScore = -Infinity;

  const candidateCount = 28;
  for (let i = 0; i < candidateCount; i++) {
    const angle = rng.range(0, Math.PI * 2);
    // Bias radial position into the sweet-spot mid-ring of the pool
    const rFrac = 0.30 + 0.68 * Math.sqrt(rng.next());
    const r = rFrac * maxRadialDist;
    const cx = Math.cos(angle) * r;
    const cy = Math.sin(angle) * r;

    const dx = cx - fromPos.x;
    const dy = cy - fromPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < minSeparation) {
      continue;
    }

    let score = 0;
    // Prefer comfortable mid-range travel distance (155..295 units)
    const idealDist = 215;
    score -= Math.abs(dist - idealDist) * 0.35;

    // Encourage sweeping curve angles (neither straight dead-ahead nor harsh 180° hairpin)
    if (hasVelocityDir && dist > 1e-3) {
      const toX = dx / dist;
      const toY = dy / dist;
      const dot = toX * velDirX + toY * velDirY; // cos(theta)
      // Early hoops prefer gentler sweeping arcs (dot around 0.1..0.75)
      const idealDot = hoopIndex < 5 ? 0.35 : 0.1;
      score -= Math.abs(dot - idealDot) * 45;
    }

    // Slight bonus for utilizing varied quadrants
    score += rng.range(-8, 8);

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = { x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 };
    }
  }

  if (bestScore === -Infinity) {
    // Fallback opposite across pool center
    const oppAngle = Math.atan2(-fromPos.y, -fromPos.x) + rng.range(-0.45, 0.45);
    const r = maxRadialDist * 0.62;
    return {
      x: Math.round(Math.cos(oppAngle) * r * 10) / 10,
      y: Math.round(Math.sin(oppAngle) * r * 10) / 10
    };
  }

  return bestCandidate;
}

export function createHoopTarget(
  id        ,
  hoopIndex        ,
  position      ,
  puckPos      ,
  config              
)             {
  const radius = computeHoopRadius(hoopIndex, config);
  const cleanRadius = Number((radius * config.cleanShotCenterRatio).toFixed(2));
  const distFromPuck = Math.hypot(position.x - puckPos.x, position.y - puckPos.y);
  const maxTimer = computeHoopCountdown(hoopIndex, distFromPuck, config);

  return {
    id,
    index: hoopIndex,
    x: position.x,
    y: position.y,
    radius,
    cleanRadius,
    maxTimer,
    timer: maxTimer,
    spawnAnim: 0,
    // Hoop #0 starts counting down as soon as the player makes their first tap (or if puck moves)
    timerActive: hoopIndex > 0
  };
}


//# sourceURL=hoops.ts