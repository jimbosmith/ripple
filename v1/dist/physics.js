             
                    
                  
            
                   
            
               
             
       
               
                    
import { createHoopTarget, pickNextHoopPosition } from './hoops.js?v=1';
import { SeededRNG } from './rng.js?v=1';

                             
                       
                                                                         
                            
                             
                       
                     
                          
                        
                               
                     
                                                        
 

export function createEmptyEvents()             {
  return {
    tapAccepted: false,
    tapRejectedReason: null,
    waveImpactedPuck: false,
    waveImpactStrength: 0,
    hoopCleared: false,
    cleanShot: false,
    cleanMultiplier: 1,
    edgeRecovery: false,
    countdownTickUrgent: false,
    runFailed: false,
    failureReason: null
  };
}

let nextEntityId = 1;
export function allocId()         {
  return nextEntityId++;
}

export function createInitialPuck(config              )            {
  return {
    x: 0,
    y: 68,
    vx: 0,
    vy: 0,
    radius: config.puckRadius,
    tiltX: 0,
    tiltY: 0,
    tiltVx: 0,
    tiltVy: 0,
    bobZ: 0,
    bobVz: 0,
    wake: [],
    minRimDistDuringApproach: config.poolRadius,
    inEdgeDanger: false,
    timeSinceHit: 99
  };
}

/**
 * Closest point on segment AB to point P, returning distance and parameter t in [0, 1].
 */
export function closestPointOnSegment(
  ax        ,
  ay        ,
  bx        ,
  by        ,
  px        ,
  py        
)                                                      {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-8) {
    return { dist: Math.hypot(px - ax, py - ay), t: 0, cx: ax, cy: ay };
  }
  const apx = px - ax;
  const apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return { dist: Math.hypot(px - cx, py - cy), t, cx, cy };
}

/**
 * Attempt to spawn an expanding circular ripple at pool coordinates (tapX, tapY).
 * Enforces:
 * 1. Taps outside the pool basin are rejected (near-rim taps are clamped inside the meniscus).
 * 2. You never touch the puck itself (taps within puckTapExclusionRadius are rejected).
 * 3. Only one ripple can exist at a time (~0.5s commitment).
 */
export function trySpawnRipple(
  state           ,
  tapX        ,
  tapY        ,
  config              
)             {
  const events = createEmptyEvents();
  if (state.phase !== 'playing') {
    return events;
  }

  state.telemetry.tapsTotal += 1;

  // Check pool bounds (allow a small forgiving bezel around the inner rim so edge-save taps always register)
  const radialDist = Math.hypot(tapX, tapY);
  if (radialDist > config.poolRadius + 24) {
    events.tapRejectedReason = 'outside_pool';
    return events;
  }

  // Clamp slightly inside the water rim if tapped right on the bevel
  let clampedX = tapX;
  let clampedY = tapY;
  const maxTapRadius = config.poolRadius - 4;
  if (radialDist > maxTapRadius && radialDist > 1e-5) {
    const scale = maxTapRadius / radialDist;
    clampedX = tapX * scale;
    clampedY = tapY * scale;
  }

  // Rule: You never touch the puck itself
  const distToPuck = Math.hypot(clampedX - state.puck.x, clampedY - state.puck.y);
  if (distToPuck < config.puckTapExclusionRadius) {
    events.tapRejectedReason = 'on_puck';
    state.telemetry.tapsBlockedOnPuck += 1;
    state.ghostTaps.push({
      x: clampedX,
      y: clampedY,
      age: 0,
      duration: 0.32,
      reason: 'on_puck'
    });
    state.callouts.push({
      id: allocId(),
      text: 'TAP WATER AROUND PUCK',
      x: state.puck.x,
      y: state.puck.y - 30,
      age: 0,
      duration: 0.75,
      kind: 'info'
    });
    return events;
  }

  // Crucial rule: Only one ripple can exist at a time
  if (state.activeRipple !== null) {
    events.tapRejectedReason = 'ripple_active';
    state.telemetry.tapsBlockedByActiveRipple += 1;
    state.ghostTaps.push({
      x: clampedX,
      y: clampedY,
      age: 0,
      duration: 0.28,
      reason: 'ripple_active'
    });
    return events;
  }

  // Spawn the single active ripple
  const maxRadius = config.rippleInitialRadius + config.waveSpeed * config.rippleDurationSec;
  const ripple             = {
    id: allocId(),
    x: clampedX,
    y: clampedY,
    age: 0,
    duration: config.rippleDurationSec,
    currentRadius: config.rippleInitialRadius,
    prevRadius: config.rippleInitialRadius,
    maxRadius,
    waveSpeed: config.waveSpeed,
    hasImpactedPuck: false,
    impactStrength: 0,
    impactPoint: null
  };

  state.activeRipple = ripple;
  events.tapAccepted = true;

  // Activate Hoop #1 countdown on the first valid tap
  if (!state.currentHoop.timerActive) {
    state.currentHoop.timerActive = true;
  }

  // Spawn subtle water droplet particles at the tap origin
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI * 2 * i) / 6 + (i % 2) * 0.2;
    const spd = 24 + (i % 3) * 14;
    state.particles.push({
      x: clampedX,
      y: clampedY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      radius: 1.6,
      age: 0,
      maxAge: 0.34,
      color: '#7ce8ff',
      alpha: 0.75
    });
  }

  return events;
}

/**
 * Evaluates whether the puck's movement from (prevX, prevY) to (puck.x, puck.y)
 * should trigger collection of the current hoop, and whether it qualifies as a Clean Shot.
 */
function checkHoopPassage(
  state           ,
  prevX        ,
  prevY        ,
  config              ,
  rng           ,
  events            
)       {
  const hoop = state.currentHoop;
  const puck = state.puck;

  const seg = closestPointOnSegment(prevX, prevY, puck.x, puck.y, hoop.x, hoop.y);
  const curDist = Math.hypot(puck.x - hoop.x, puck.y - hoop.y);
  const prevDist = Math.hypot(prevX - hoop.x, prevY - hoop.y);

  // Is the puck within the hoop's capture radius?
  if (seg.dist > hoop.radius && curDist > hoop.radius) {
    return;
  }

  const speed = Math.hypot(puck.vx, puck.vy);
  const dx = puck.x - hoop.x;
  const dy = puck.y - hoop.y;
  // Dot product of (puck - hoop) and velocity: >= 0 means puck has reached or passed the closest approach point
  const movingAwayOrPastApex = dx * puck.vx + dy * puck.vy >= -2.0;
  const deepInBullseye = seg.dist <= hoop.cleanRadius * 0.55;
  const nearlyStoppedInside = speed < 22 && curDist <= hoop.radius * 0.92;
  const timerAboutToExpireInside = hoop.timer <= 0.05 && curDist <= hoop.radius;

  if (!deepInBullseye && !movingAwayOrPastApex && !nearlyStoppedInside && !timerAboutToExpireInside) {
    // Still approaching the center of the hoop — let it reach its closest approach on the next substep
    return;
  }

  const closestDist = Math.min(seg.dist, curDist, prevDist);
  const isClean = closestDist <= hoop.cleanRadius;

  events.hoopCleared = true;
  events.cleanShot = isClean;

  state.hoopsCleared += 1;
  state.telemetry.hoopsCleared = state.hoopsCleared;

  if (isClean) {
    state.cleanStreak += 1;
    state.multiplier = Math.min(8, state.multiplier + 1);
    state.telemetry.cleanShots += 1;
    state.telemetry.maxMultiplier = Math.max(state.telemetry.maxMultiplier, state.multiplier);
  } else {
    state.cleanStreak = 0;
    // Non-clean pass keeps multiplier at 1 (or steps down gently if high)
    state.multiplier = Math.max(1, state.multiplier - 1);
  }

  events.cleanMultiplier = state.multiplier;

  const basePoints = isClean ? 150 : 100;
  const pointsAwarded = basePoints * state.multiplier;
  state.score += pointsAwarded;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
  }
  if (state.hoopsCleared > state.bestHoops) {
    state.bestHoops = state.hoopsCleared;
  }

  // Record cleared hoop visual effect
  const effect                    = {
    x: hoop.x,
    y: hoop.y,
    radius: hoop.radius,
    cleanRadius: hoop.cleanRadius,
    isClean,
    multiplier: state.multiplier,
    pointsAwarded,
    age: 0,
    duration: isClean ? 0.85 : 0.55
  };
  state.clearedEffects.push(effect);

  // Boost wake glow on clean shots
  for (const w of puck.wake) {
    if (isClean) {
      w.cleanGlow = Math.max(w.cleanGlow, 1.0);
    }
  }

  // Floating callout
  if (isClean) {
    state.callouts.push({
      id: allocId(),
      text: state.multiplier > 1 ? `CLEAN SHOT ×${state.multiplier}` : 'CLEAN SHOT!',
      subtext: `+${pointsAwarded}`,
      x: hoop.x,
      y: hoop.y - hoop.radius - 14,
      age: 0,
      duration: 1.05,
      kind: 'clean'
    });
  } else {
    state.callouts.push({
      id: allocId(),
      text: `+${pointsAwarded}`,
      x: hoop.x,
      y: hoop.y - hoop.radius - 10,
      age: 0,
      duration: 0.75,
      kind: 'normal'
    });
  }

  // Spawn celebration particles
  const particleCount = isClean ? 18 : 8;
  for (let i = 0; i < particleCount; i++) {
    const ang = (Math.PI * 2 * i) / particleCount;
    const spd = isClean ? 65 + (i % 3) * 35 : 35 + (i % 2) * 20;
    state.particles.push({
      x: hoop.x + Math.cos(ang) * (isClean ? hoop.cleanRadius : hoop.radius * 0.7),
      y: hoop.y + Math.sin(ang) * (isClean ? hoop.cleanRadius : hoop.radius * 0.7),
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      radius: isClean ? 2.4 : 1.7,
      age: 0,
      maxAge: isClean ? 0.65 : 0.42,
      color: isClean ? '#ffe680' : '#64e8ff',
      alpha: 0.95
    });
  }

  // Advance to the next hoop using the previewed position, then generate a new preview
  const nextIndex = hoop.index + 1;
  const nextPos       = { x: state.nextHoopPreview.x, y: state.nextHoopPreview.y };
  state.currentHoop = createHoopTarget(
    allocId(),
    nextIndex,
    nextPos,
    { x: puck.x, y: puck.y },
    config
  );
  state.nextHoopPreview = pickNextHoopPosition(
    nextIndex + 1,
    nextPos,
    { x: puck.vx, y: puck.vy },
    rng,
    config
  );
}

/**
 * Builds a helpful, specific diagnostic message when a run ends so failure produces
 * an immediate "I tapped too late" insight before the next one-tap attempt.
 */
function buildFailureDiagnostic(
  state           ,
  reason                                 ,
  config              
)         {
  const puck = state.puck;
  const ripple = state.activeRipple;

  if (ripple && !ripple.hasImpactedPuck) {
    const distToPuck = Math.hypot(puck.x - ripple.x, puck.y - ripple.y);
    const waveGap = Math.max(2, Math.round(distToPuck - ripple.currentRadius));
    const msLate = Math.max(10, Math.round((waveGap / config.waveSpeed) * 1000));
    return `Tapped ~${msLate}ms too late — wave was ${waveGap}px from the puck.`;
  }

  if (reason === 'edge_contact') {
    if (puck.timeSinceHit < 0.35) {
      return 'Carried into the rim — tap slightly sooner to counter momentum.';
    }
    return 'Touched the pool edge — tap ahead of the puck to brake.';
  }

  const distToHoopEdge = Math.max(
    1,
    Math.round(Math.hypot(puck.x - state.currentHoop.x, puck.y - state.currentHoop.y) - state.currentHoop.radius)
  );
  if (distToHoopEdge < 55) {
    return `Countdown expired just ${distToHoopEdge}px shy of the hoop.`;
  }
  return 'Hoop countdown expired — tap behind a moving puck to accelerate.';
}

/**
 * Advances the simulation by `dt` seconds using deterministic substepping.
 */
export function stepPhysics(
  state           ,
  dt        ,
  config              ,
  rng           
)             {
  const events = createEmptyEvents();

  // Always update visual particles/callouts even during gameover freeze
  const clampedDt = Math.min(5.0, Math.max(0, dt));
  updateVisualEffects(state, clampedDt);

  if (state.phase !== 'playing') {
    if (state.phase === 'gameover' && state.failureFreezeTimer > 0) {
      state.failureFreezeTimer = Math.max(0, state.failureFreezeTimer - clampedDt);
    }
    return events;
  }

  state.runTimeSec += clampedDt;

  // Substep for accurate wave-puck intersection and swept hoop detection
  const maxSubStep = 1 / 240;
  const steps = Math.max(1, Math.ceil(clampedDt / maxSubStep));
  const subDt = clampedDt / steps;

  const prevHoopSecFloor = Math.ceil(state.currentHoop.timer);

  for (let s = 0; s < steps; s++) {
    if (state.phase !== 'playing') {
      break;
    }

    const puck = state.puck;
    const prevX = puck.x;
    const prevY = puck.y;
    puck.timeSinceHit += subDt;

    // 1. Update active ripple wave expansion & wave-puck push
    const ripple = state.activeRipple;
    if (ripple) {
      ripple.prevRadius = ripple.currentRadius;
      ripple.age += subDt;
      ripple.currentRadius = config.rippleInitialRadius + ripple.waveSpeed * ripple.age;

      if (!ripple.hasImpactedPuck) {
        const dx = puck.x - ripple.x;
        const dy = puck.y - ripple.y;
        const dist = Math.hypot(dx, dy);

        // Wave crest reaches the puck's hull
        const contactDist = Math.max(config.rippleInitialRadius, dist - puck.radius * 0.35);
        if (ripple.currentRadius >= contactDist && dist <= ripple.maxRadius + puck.radius * 0.65) {
          const ux = dist > 1e-5 ? dx / dist : 1;
          const uy = dist > 1e-5 ? dy / dist : 0;

          const minDist = config.puckTapExclusionRadius;
          const maxReach = ripple.maxRadius + puck.radius;
          const normDist = Math.max(0, Math.min(1, (dist - minDist) / Math.max(1, maxReach - minDist)));
          const strength =
            1 - (1 - config.minDistanceImpulseRatio) * Math.pow(normDist, 1.08);

          const basePush = config.baseWaveImpulse * strength;

          // If puck is moving toward the ripple origin (v · u < 0), absorb opposing velocity for crisp braking
          const radialVel = puck.vx * ux + puck.vy * uy;
          const brakeBoost = radialVel < 0 ? -radialVel * config.headOnBrakingFactor * strength : 0;

          const totalDeltaV = basePush + brakeBoost;
          puck.vx += ux * totalDeltaV;
          puck.vy += uy * totalDeltaV;

          // Clamp max speed
          const newSpeed = Math.hypot(puck.vx, puck.vy);
          if (newSpeed > config.maxPuckSpeed) {
            const scale = config.maxPuckSpeed / newSpeed;
            puck.vx *= scale;
            puck.vy *= scale;
          }

          // Impart 2.5D wave rock & buoyancy bob
          puck.tiltVx += ux * 15 * strength;
          puck.tiltVy += uy * 15 * strength;
          puck.bobVz += 8.5 * strength;
          puck.timeSinceHit = 0;

          ripple.hasImpactedPuck = true;
          ripple.impactStrength = strength;
          ripple.impactPoint = { x: puck.x, y: puck.y };

          state.telemetry.lastWaveTravelMs = Math.round(ripple.age * 1000);
          state.telemetry.lastImpactSpeedDelta = Math.round(totalDeltaV);

          events.waveImpactedPuck = true;
          events.waveImpactStrength = Math.max(events.waveImpactStrength, strength);

          // Spawn spray droplets on the pushed side of the puck
          for (let i = 0; i < 9; i++) {
            const spread = ((i - 4) / 4) * 0.85;
            const ang = Math.atan2(uy, ux) + spread;
            const spd = (55 + (i % 3) * 28) * strength;
            state.particles.push({
              x: puck.x - ux * puck.radius * 0.6,
              y: puck.y - uy * puck.radius * 0.6,
              vx: Math.cos(ang) * spd + puck.vx * 0.25,
              vy: Math.sin(ang) * spd + puck.vy * 0.25,
              radius: 1.9,
              age: 0,
              maxAge: 0.45,
              color: '#9bf0ff',
              alpha: 0.85
            });
          }
        }
      }

      // Expire the ripple once its commitment duration (~0.50s) completes
      if (ripple.age >= ripple.duration) {
        state.activeRipple = null;
      }
    }

    // 2. Integrate puck velocity & hydrodynamic water drag
    const speed = Math.hypot(puck.vx, puck.vy);
    if (speed > 1e-5) {
      const dragDecel =
        config.linearWaterDrag * speed + config.quadraticWaterDrag * speed * speed;
      const nextSpeed = Math.max(0, speed - dragDecel * subDt);
      const ratio = nextSpeed / speed;
      puck.vx *= ratio;
      puck.vy *= ratio;
    }

    puck.x += puck.vx * subDt;
    puck.y += puck.vy * subDt;

    // 3. Spring-damper for 2.5D puck tilt and vertical bob
    const tiltSpring = 54;
    const tiltDamp = 9.5;
    puck.tiltVx += (-tiltSpring * puck.tiltX - tiltDamp * puck.tiltVx) * subDt;
    puck.tiltVy += (-tiltSpring * puck.tiltY - tiltDamp * puck.tiltVy) * subDt;
    puck.tiltX = Math.max(-1.2, Math.min(1.2, puck.tiltX + puck.tiltVx * subDt));
    puck.tiltY = Math.max(-1.2, Math.min(1.2, puck.tiltY + puck.tiltVy * subDt));

    puck.bobVz += (-68 * puck.bobZ - 8.2 * puck.bobVz) * subDt;
    puck.bobZ = Math.max(-1.0, Math.min(1.0, puck.bobZ + puck.bobVz * subDt));

    // 4. Edge danger & Counter-Ripple Recovery check
    const radialDist = Math.hypot(puck.x, puck.y);
    const rimClearance = config.poolRadius - puck.radius - radialDist;
    const outwardVel =
      radialDist > 1e-4 ? (puck.x * puck.vx + puck.y * puck.vy) / radialDist : 0;

    if (rimClearance < config.edgeDangerMargin && outwardVel > 28) {
      puck.inEdgeDanger = true;
      puck.minRimDistDuringApproach = Math.min(puck.minRimDistDuringApproach, rimClearance);
    }

    if (puck.inEdgeDanger && rimClearance > 0) {
      // Saved if a recent counter-ripple deflected outward velocity inward/safe and puck is retreating from rim
      if (puck.timeSinceHit < 0.35 && outwardVel < -8 && rimClearance > puck.minRimDistDuringApproach + 3) {
        puck.inEdgeDanger = false;
        puck.minRimDistDuringApproach = config.poolRadius;
        events.edgeRecovery = true;
        state.telemetry.recoveries += 1;
        const recoveryBonus = 75 * state.multiplier;
        state.score += recoveryBonus;
        if (state.score > state.bestScore) {
          state.bestScore = state.score;
        }
        state.callouts.push({
          id: allocId(),
          text: 'CLOSE SAVE!',
          subtext: `+${recoveryBonus}`,
          x: puck.x * 0.82,
          y: puck.y * 0.82,
          age: 0,
          duration: 0.95,
          kind: 'recovery'
        });
      } else if (rimClearance > config.edgeDangerMargin + 18) {
        puck.inEdgeDanger = false;
        puck.minRimDistDuringApproach = config.poolRadius;
      }
    }

    // 5. Check Hoop Passage (before failure check so a frame that enters the hoop wins)
    checkHoopPassage(state, prevX, prevY, config, rng, events);

    // 6. Check Pool Edge Contact (touch the pool's edge and your run ends)
    if (rimClearance <= 0) {
      // Clamp puck flush against the inner pool edge for the freeze-frame
      if (radialDist > 1e-5) {
        const maxR = config.poolRadius - puck.radius;
        puck.x = (puck.x / radialDist) * maxR;
        puck.y = (puck.y / radialDist) * maxR;
      }
      puck.vx = 0;
      puck.vy = 0;
      state.phase = 'gameover';
      state.failureReason = 'edge_contact';
      state.failureDiagnostic = buildFailureDiagnostic(state, 'edge_contact', config);
      state.telemetry.lastMissDiagnostic = state.failureDiagnostic;
      state.failureFreezeTimer = 0.18;
      events.runFailed = true;
      events.failureReason = 'edge_contact';
      break;
    }

    // 7. Update Hoop Countdown & Check Expiration
    state.currentHoop.spawnAnim = Math.min(1, state.currentHoop.spawnAnim + subDt * 4.2);
    if (state.currentHoop.timerActive) {
      state.currentHoop.timer = Math.max(0, state.currentHoop.timer - subDt);
      if (state.currentHoop.timer <= 0) {
        state.phase = 'gameover';
        state.failureReason = 'hoop_timeout';
        state.failureDiagnostic = buildFailureDiagnostic(state, 'hoop_timeout', config);
        state.telemetry.lastMissDiagnostic = state.failureDiagnostic;
        state.failureFreezeTimer = 0.18;
        events.runFailed = true;
        events.failureReason = 'hoop_timeout';
        break;
      }
    }
  }

  // Urgent countdown tick event when crossing whole half-seconds under 2.0s
  const newHoopSecFloor = Math.ceil(state.currentHoop.timer);
  if (
    state.phase === 'playing' &&
    state.currentHoop.timerActive &&
    state.currentHoop.timer <= 2.0 &&
    newHoopSecFloor < prevHoopSecFloor
  ) {
    events.countdownTickUrgent = true;
  }

  return events;
}

function updateVisualEffects(state           , dt        )       {
  const puck = state.puck;
  const speed = Math.hypot(puck.vx, puck.vy);

  // Sample wake ribbon points behind moving puck
  if (state.phase === 'playing' && speed > 10) {
    const lastWake = puck.wake[puck.wake.length - 1];
    const distFromLast = lastWake ? Math.hypot(puck.x - lastWake.x, puck.y - lastWake.y) : 999;
    if (distFromLast >= 4.5) {
      puck.wake.push({
        x: puck.x,
        y: puck.y,
        age: 0,
        maxAge: 0.75,
        speed,
        cleanGlow: state.multiplier > 1 ? Math.min(1, (state.multiplier - 1) * 0.25) : 0
      });
    }
  }

  for (let i = puck.wake.length - 1; i >= 0; i--) {
    puck.wake[i].age += dt;
    if (puck.wake[i].age >= puck.wake[i].maxAge) {
      puck.wake.splice(i, 1);
    }
  }

  for (let i = state.clearedEffects.length - 1; i >= 0; i--) {
    state.clearedEffects[i].age += dt;
    if (state.clearedEffects[i].age >= state.clearedEffects[i].duration) {
      state.clearedEffects.splice(i, 1);
    }
  }

  for (let i = state.ghostTaps.length - 1; i >= 0; i--) {
    state.ghostTaps[i].age += dt;
    if (state.ghostTaps[i].age >= state.ghostTaps[i].duration) {
      state.ghostTaps.splice(i, 1);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 3.2 * dt);
    p.vy *= Math.max(0, 1 - 3.2 * dt);
    if (p.age >= p.maxAge) {
      state.particles.splice(i, 1);
    }
  }

  for (let i = state.callouts.length - 1; i >= 0; i--) {
    state.callouts[i].age += dt;
    if (state.callouts[i].age >= state.callouts[i].duration) {
      state.callouts.splice(i, 1);
    }
  }
}


//# sourceURL=physics.ts